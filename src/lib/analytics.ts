
import { createClient } from '@/lib/supabase/client';

export class AnalyticsService {
  private supabase = createClient();
  private sessionId: string | null = null;
  private lastActiveTime: number = Date.now();
  private inactivityTimeout: NodeJS.Timeout | null = null;
  private activityInterval: NodeJS.Timeout | null = null;

  // Track user session
  async startSession(userId: string) {
    try {
      // Check if there's an active session already
      const { data: existingSessions } = await this.supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .is('ended_at', null)
        .gte('last_active_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      // End any existing sessions first
      if (existingSessions && existingSessions.length > 0) {
        await this.supabase
          .from('user_sessions')
          .update({ ended_at: new Date().toISOString() })
          .in('id', existingSessions.map(s => s.id));
      }

      const { data, error } = await this.supabase
        .from('user_sessions')
        .insert({ 
          user_id: userId,
          started_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error starting session:', error);
        return null;
      }

      if (data) {
        this.sessionId = data.id;
        this.lastActiveTime = Date.now();
        this.startActivityTracking();
        console.log('Session started:', data.id);
        return data.id;
      }
    } catch (err) {
      console.error('Session start error:', err);
    }
    return null;
  }

  // Start periodic activity updates
  private startActivityTracking() {
    // Clear any existing interval
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }

    // Update activity every 30 seconds
    this.activityInterval = setInterval(() => {
      this.updateActivity();
    }, 30000);

    // Initial update
    this.updateActivity();
  }

  // Update session activity
  private async updateActivity() {
    if (!this.sessionId) return;

    try {
      this.lastActiveTime = Date.now();
      
      await this.supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', this.sessionId);
      
      console.log('Activity updated');
    } catch (err) {
      console.error('Error updating activity:', err);
    }

    // Reset inactivity timeout
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }

    // Set inactivity timeout (5 minutes)
    this.inactivityTimeout = setTimeout(() => {
      this.endSession();
    }, 5 * 60 * 1000);
  }

  // End session
  async endSession() {
    if (!this.sessionId) return;

    try {
      const startTime = this.lastActiveTime - (Date.now() - this.lastActiveTime);
      const duration = Math.floor((Date.now() - startTime) / 1000);
      
      await this.supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: Math.max(0, duration),
        })
        .eq('id', this.sessionId);

      console.log('Session ended');
      
      // Clear intervals
      if (this.activityInterval) {
        clearInterval(this.activityInterval);
        this.activityInterval = null;
      }
      if (this.inactivityTimeout) {
        clearTimeout(this.inactivityTimeout);
        this.inactivityTimeout = null;
      }
      
      this.sessionId = null;
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }

  // Track video view (called once per video)
  async trackVideoView(userId: string, videoId: string) {
    try {
      await this.trackEvent(userId, 'video_view', { video_id: videoId });
      
      // Check if analytics record exists
      const { data: existing } = await this.supabase
        .from('video_analytics')
        .select('id, watch_duration_seconds')
        .eq('user_id', userId)
        .eq('video_id', videoId)
        .maybeSingle();

      if (!existing) {
        // Create new record
        await this.supabase
          .from('video_analytics')
          .insert({ 
            user_id: userId, 
            video_id: videoId,
            watch_duration_seconds: 0,
            last_position_seconds: 0,
            completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        console.log('Video analytics record created for:', videoId);
      }
    } catch (err) {
      console.error('Error tracking video view:', err);
    }
  }

  async trackVideoWatchTime(
  userId: string,
  videoId: string,
  watchedSeconds: number,  
  currentPosition: number,
  totalDuration: number
) {
  try {
    const completed = currentPosition >= totalDuration * 0.9;

    // Get existing record
    const { data: existing } = await this.supabase
      .from('video_analytics')
      .select('watch_duration_seconds, last_position_seconds, completed')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .maybeSingle();

    // Use MAXIMUM position ever reached
    const maxPosition = Math.max(
      existing?.last_position_seconds ?? 0,
      Math.floor(currentPosition)
    );

    // Use maximum position as watch duration
    const newWatchTime = Math.max(
      existing?.watch_duration_seconds ?? 0,
      maxPosition
    );

    // Mark completed if EVER reached 90%
    const newCompleted = existing?.completed || (maxPosition >= totalDuration * 0.9);

    await this.supabase
      .from('video_analytics')
      .update({
        watch_duration_seconds: newWatchTime,
        last_position_seconds: maxPosition,
        completed: newCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('video_id', videoId);

    console.log('✅', { videoId, maxPosition, total: totalDuration, completed: newCompleted });

  } catch (err) {
    console.error('Error:', err);
  }
}

  // Track post view
  async trackPostView(userId: string, postId: string) {
    try {
      await this.trackEvent(userId, 'post_view', { post_id: postId });
    } catch (err) {
      console.error('Error tracking post view:', err);
    }
  }

  // Generic event tracking
  async trackEvent(
    userId: string,
    eventType: string,
    metadata: Record<string, unknown> = {}
  ) {
    try {
      await this.supabase
        .from('analytics_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('Error tracking event:', err);
    }
  }

  // Setup listeners for activity
  setupActivityListeners() {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handler = () => this.updateActivity();
    
    events.forEach(event => {
      window.addEventListener(event, handler, { passive: true });
    });

    // Track page visibility
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        await this.endSession();
      } else {
        // Restart session when page becomes visible
        const { data } = await this.supabase.auth.getUser();
        if (data.user) {
          await this.startSession(data.user.id);
        }
      }
    });

    // End session on page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }
}

export const analytics = new AnalyticsService();