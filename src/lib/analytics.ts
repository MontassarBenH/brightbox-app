// lib/analytics.ts
import { createClient } from '@/lib/supabase/client';

export class AnalyticsService {
  private supabase = createClient();
  private sessionId: string | null = null;
  private lastActiveTime: number = Date.now();
  private inactivityTimeout: NodeJS.Timeout | null = null;

  // Track user session
  async startSession(userId: string) {
    const { data, error } = await this.supabase
      .from('user_sessions')
      .insert({ user_id: userId })
      .select()
      .single();

    if (data) {
      this.sessionId = data.id;
      this.trackActivity();
      return data.id;
    }
    return null;
  }

  // Update session activity
  private trackActivity() {
    // Clear existing timeout
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }

    // Update last active time
    this.lastActiveTime = Date.now();

    if (this.sessionId) {
      this.supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', this.sessionId)
        .then();
    }

    // Set inactivity timeout (5 minutes)
    this.inactivityTimeout = setTimeout(() => {
      this.endSession();
    }, 5 * 60 * 1000);
  }

  // End session
  async endSession() {
    if (!this.sessionId) return;

    const duration = Math.floor((Date.now() - this.lastActiveTime) / 1000);
    
    await this.supabase
      .from('user_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      })
      .eq('id', this.sessionId);

    this.sessionId = null;
  }

  // Track video view
  async trackVideoView(userId: string, videoId: string) {
    await this.trackEvent(userId, 'video_view', { video_id: videoId });
    
    // Create or get video analytics record
    const { data: existing } = await this.supabase
      .from('video_analytics')
      .select('id')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .single();

    if (!existing) {
      await this.supabase
        .from('video_analytics')
        .insert({ user_id: userId, video_id: videoId });
    }
  }

  // Track video watch time
  async trackVideoWatchTime(
    userId: string,
    videoId: string,
    watchedSeconds: number,
    currentPosition: number,
    totalDuration: number
  ) {
    const completed = currentPosition >= totalDuration * 0.95;

    await this.supabase
      .from('video_analytics')
      .upsert({
        user_id: userId,
        video_id: videoId,
        watch_duration_seconds: watchedSeconds,
        last_position_seconds: currentPosition,
        completed,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,video_id',
      });

    await this.trackEvent(userId, 'video_watch_time', {
      video_id: videoId,
      watched_seconds: watchedSeconds,
      completed,
    });
  }

  // Track post view
  async trackPostView(userId: string, postId: string) {
    await this.trackEvent(userId, 'post_view', { post_id: postId });
  }

  // Generic event tracking
  async trackEvent(
    userId: string,
    eventType: string,
    metadata: Record<string, any> = {}
  ) {
    this.trackActivity(); // Update session activity

    await this.supabase
      .from('analytics_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        metadata,
      });
  }

  // Setup listeners for activity
  setupActivityListeners() {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, () => this.trackActivity(), { passive: true });
    });

    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.endSession();
      } else {
        // Restart session when page becomes visible
        const userId = this.supabase.auth.getUser().then(({ data }) => {
          if (data.user) this.startSession(data.user.id);
        });
      }
    });
  }
}

export const analytics = new AnalyticsService();