// src/lib/analytics.ts
import { createClient } from '@/lib/supabase/client';

type AnalyticsMetadata = Record<string, unknown>;

export class AnalyticsService {
  private supabase = createClient();
  private sessionId: string | null = null;
  private lastActiveTime = Date.now();
  private inactivityTimeout: NodeJS.Timeout | null = null;

  // Track user session
  async startSession(userId: string) {
    const { data, error } = await this.supabase
      .from('user_sessions')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) {
      console.error('[analytics] startSession error:', error);
      return null;
    }

    if (data) {
      this.sessionId = data.id as string;
      this.trackActivity();
      return data.id as string;
    }
    return null;
  }

  // Update session activity
  private trackActivity() {
    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);

    this.lastActiveTime = Date.now();

    if (this.sessionId) {
      // Fire and forget; log on failure so we "use" the error.
      this.supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', this.sessionId)
        .then(({ error }) => {
          if (error) console.error('[analytics] trackActivity error:', error);
        });
    }

    // Inactivity timeout (5 minutes)
    this.inactivityTimeout = setTimeout(() => {
      void this.endSession();
    }, 5 * 60 * 1000);
  }

  // End session
  async endSession() {
    if (!this.sessionId) return;

    const duration = Math.floor((Date.now() - this.lastActiveTime) / 1000);

    const { error } = await this.supabase
      .from('user_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      })
      .eq('id', this.sessionId);

    if (error) console.error('[analytics] endSession error:', error);

    this.sessionId = null;
  }

  // Track video view
  async trackVideoView(userId: string, videoId: string) {
    await this.trackEvent(userId, 'video_view', { video_id: videoId });

    const { data: existing, error } = await this.supabase
      .from('video_analytics')
      .select('id')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .maybeSingle();

    if (error) {
      console.error('[analytics] trackVideoView select error:', error);
      return;
    }

    if (!existing) {
      const { error: insertError } = await this.supabase
        .from('video_analytics')
        .insert({ user_id: userId, video_id: videoId });

      if (insertError) {
        console.error('[analytics] trackVideoView insert error:', insertError);
      }
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

    const { error: upsertError } = await this.supabase
      .from('video_analytics')
      .upsert(
        {
          user_id: userId,
          video_id: videoId,
          watch_duration_seconds: watchedSeconds,
          last_position_seconds: currentPosition,
          completed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      );

    if (upsertError) {
      console.error('[analytics] trackVideoWatchTime upsert error:', upsertError);
    }

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
  async trackEvent(userId: string, eventType: string, metadata: AnalyticsMetadata = {}) {
    this.trackActivity();

    const { error } = await this.supabase
      .from('analytics_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        metadata, // JSONB column recommended
      });

    if (error) console.error('[analytics] trackEvent error:', error);
  }

  // Setup listeners for activity
  setupActivityListeners() {
    if (typeof window === 'undefined') return;

    const events: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => this.trackActivity();

    events.forEach((evt) => {
      window.addEventListener(evt, handler, { passive: true });
    });

    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        void this.endSession();
      } else {
        // Restart session when page becomes visible
        this.supabase.auth.getUser().then(({ data, error }) => {
          if (error) {
            console.error('[analytics] getUser error:', error);
            return;
          }
          if (data.user) void this.startSession(data.user.id);
        });
      }
    });
  }
}

export const analytics = new AnalyticsService();
