'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Video as VideoIcon,
  MessageSquare,
  Heart,
  Flag,
  Clock,
  Eye,
  Activity,
  CheckCircle,
  LogOut,
  XCircle,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';


type TimeRange = '24h' | '7d' | '30d' | '90d';

type OnlineUser = {
  id: string;
  name: string;
  email: string;
  duration: number;
};

type TopVideo = {
  id: string;
  title: string;
  views: number;
  avgWatchTime: number;
  completion: number;
};

type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';


type ReportRow = {
  id: string;
  type: 'comment' | 'message' | 'video' | 'post';
  reason: string;
  description: string | null;
  reporter: string | null;
  reported: string | null;
  status: ReportStatus;
  created_at: string;
};

type InviteRow = {
  email: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};


const AdminDashboard = () => {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const sinceISO = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    if (timeRange === '24h') d.setDate(now.getDate() - 1);
    if (timeRange === '7d') d.setDate(now.getDate() - 7);
    if (timeRange === '30d') d.setDate(now.getDate() - 30);
    if (timeRange === '90d') d.setDate(now.getDate() - 90);
    return d.toISOString();
  }, [timeRange]);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalVideos: 0,
    totalPosts: 0,
    totalComments: 0,
    totalLikes: 0,
    totalReports: 0,
    pendingReports: 0,
  });

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [recentReports, setRecentReports] = useState<ReportRow[]>([]);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<InviteRow[]>([]);
  const [busyInviteEmail, setBusyInviteEmail] = useState<string | null>(null);
  const [rejectedInvites, setRejectedInvites] = useState<InviteRow[]>([]);
  const [inviteFilter, setInviteFilter] = useState<'pending' | 'rejected'>('pending');



  // ---------- helpers ----------
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };


  // Admin check via admin_users
  const checkAdmin = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    setIsAdmin(Boolean(data));
  };

  // ---------- fetchers ----------
  const loadStats = async () => {
    const [{ count: usersCount }, { count: videosCount }, { count: postsCount }, { count: commentsCount }, { count: likesCount }, { count: reportsCount }, { count: pendingCount }] =
      await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
        supabase.from('likes').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);



    const { data: activeSessions } = await supabase
      .from('user_sessions')
      .select('user_id')
      .gte('last_active_at', sinceISO);

    const activeUsers = new Set((activeSessions ?? []).map((s) => s.user_id)).size;

    setStats({
      totalUsers: usersCount ?? 0,
      activeUsers,
      totalVideos: videosCount ?? 0,
      totalPosts: postsCount ?? 0,
      totalComments: commentsCount ?? 0,
      totalLikes: likesCount ?? 0,
      totalReports: reportsCount ?? 0,
      pendingReports: pendingCount ?? 0,
    });
  };

  const loadPendingInvites = async () => {
    const { data, error } = await supabase
      .from('invites')
      .select('email, reason, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('loadPendingInvites error:', error);
      setPendingInvites([]);
      return;
    }
    setPendingInvites(data ?? []);
  };

  const loadRejectedInvites = async () => {
    const { data, error } = await supabase
      .from('invites')
      .select('email, reason, status, created_at')
      .eq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('loadRejectedInvites error:', error);
      setRejectedInvites([]);
      return;
    }
    setRejectedInvites(data ?? []);
  };


  const approveInvite = async (email: string) => {
    setBusyInviteEmail(email);
    const { error } = await supabase
      .from('invites')
      .update({ status: 'approved' })
      .eq('email', email);

    setBusyInviteEmail(null);
    if (error) {
      console.error('approveInvite error:', error);
      return;
    }
    setPendingInvites(prev => prev.filter(i => i.email !== email));
    setRejectedInvites(prev => prev.filter(i => i.email !== email));
  };

  const rejectInvite = async (email: string) => {
    setBusyInviteEmail(email);
    const { error } = await supabase
      .from('invites')
      .update({ status: 'rejected' })
      .eq('email', email);

    setBusyInviteEmail(null);
    if (error) {
      console.error('rejectInvite error:', error);
      return;
    }
    setPendingInvites(prev => prev.filter(i => i.email !== email));
    setRejectedInvites(prev => [{ ...prev.find(p => p.email === email)!, status: 'rejected' }, ...prev]);
  };

  const loadOnlineUsers = async () => {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('user_id, started_at, last_active_at')
      .gte('last_active_at', since)
      .order('last_active_at', { ascending: false });

    const userIds = Array.from(new Set((sessions ?? []).map((s) => s.user_id)));
    if (userIds.length === 0) {
      setOnlineUsers([]);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', userIds);

    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rows: OnlineUser[] = (sessions ?? []).map((s) => {
      const p = map.get(s.user_id);
      const duration = Math.max(
        0,
        Math.floor((new Date(s.last_active_at as string).getTime() - new Date(s.started_at as string).getTime()) / 1000)
      );
      return {
        id: s.user_id,
        name: p?.username || p?.email || 'User',
        email: p?.email || '',
        duration,
      };
    });

    // unique by user and take latest
    const uniq = new Map<string, OnlineUser>();
    rows.forEach((r) => { if (!uniq.has(r.id)) uniq.set(r.id, r); });
    setOnlineUsers(Array.from(uniq.values()));
  };

  const loadTopVideos = async () => {
    const { data: va, error } = await supabase
      .from('video_analytics')
      .select('video_id, user_id, watch_duration_seconds, completed, updated_at')
      .order('watch_duration_seconds', { ascending: false });

    if (error) {
      console.error('video_analytics query error:', error);
      setTopVideos([]);
      return;
    }

    let rows = va ?? [];
    if (rows.length === 0) {
      const fallback = await supabase
        .from('video_analytics')
        .select('video_id, user_id, watch_duration_seconds, completed, updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);
      rows = fallback.data ?? [];
    }

    if (rows.length === 0) {
      setTopVideos([]);
      return;
    }

    // Aggregate per video
    const agg = new Map<
      string,
      { viewers: Set<string>; totalWatch: number; completedCount: number; totalRows: number }
    >();

    for (const r of rows) {
      const vid = r.video_id as string;
      const entry =
        agg.get(vid) ?? { viewers: new Set<string>(), totalWatch: 0, completedCount: 0, totalRows: 0 };

      // accumulate
      entry.totalRows += 1;
      if (r.user_id) entry.viewers.add(r.user_id as string);
      entry.totalWatch += Math.max(0, Number(r.watch_duration_seconds ?? 0));
      if (r.completed === true) entry.completedCount += 1;

      agg.set(vid, entry);
    }
    const videoIds = Array.from(agg.keys());
    if (videoIds.length === 0) {
      setTopVideos([]);
      return;
    }

    // Titles
    const { data: vids } = await supabase
      .from('videos')
      .select('id, title')
      .in('id', videoIds);

    const titleMap = new Map((vids ?? []).map(v => [v.id, v.title || 'Untitled']));

    const list: TopVideo[] = videoIds.map(id => {
      const a = agg.get(id)!;

      const views = a.viewers.size > 0 ? a.viewers.size : a.totalRows;

      const avgWatchTime = views > 0 ? Math.round(a.totalWatch / views) : 0;

      const completionNum =
        views > 0 ? Math.round((a.completedCount / views) * 100) : 0;

      return {
        id,
        title: titleMap.get(id) ?? 'Untitled',
        views,
        avgWatchTime,
        completion: Number.isFinite(completionNum) ? completionNum : 0,
      };
    });


    list.sort((x, y) => y.views - x.views);
    setTopVideos(list.slice(0, 10));
  };

  const updateReportStatus = async (id: string, status: ReportStatus) => {
    setBusyReportId(id);
    const { error } = await supabase
      .from('reports')
      .update({ status })        // <-- only use values allowed by DB
      .eq('id', id)
      .select();
    setBusyReportId(null);
    if (error) { console.error('updateReportStatus error:', error); return; }
    loadStats(); loadRecentReports();
  };


  const loadRecentReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    console.log('Reports query result:', { data, error });

    if (error) {
      console.error('Reports query error:', error);
      setRecentReports([]);
      return;
    }

    if (!data || data.length === 0) {
      setRecentReports([]);
      return;
    }

    const reporterIds = Array.from(new Set(data.map((r) => r.reporter_id).filter(Boolean)));
    const reportedIds = Array.from(new Set(data.map((r) => r.reported_user_id).filter(Boolean)));
    const ids = Array.from(new Set([...reporterIds, ...reportedIds]));

    let emails = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,email')
        .in('id', ids);
      emails = new Map((profs ?? []).map((p) => [p.id, p.email || '']));
    }

    const rows: ReportRow[] = data.map((r) => ({
      id: r.id,
      type: r.content_type as ReportRow['type'],
      reason: r.reason,
      description: r.description || null,
      reporter: r.reporter_id ? emails.get(r.reporter_id) ?? null : null,
      reported: r.reported_user_id ? emails.get(r.reported_user_id) ?? null : null,
      status: r.status,
      created_at: r.created_at,
    }));

    console.log('Processed reports:', rows);
    setRecentReports(rows);
  };


  // ---------- effects ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      await checkAdmin();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadOnlineUsers();
      loadTopVideos();
      loadRecentReports();
      loadPendingInvites();
      loadRejectedInvites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, sinceISO]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900">Access denied</p>
          <p className="text-gray-600">You must be an admin to view this page.</p>
        </div>
      </div>
    );
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Monitor and manage your SchoolFeed platform</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers} change={null} color="purple" />
          <StatCard icon={Activity} label="Active Users" value={stats.activeUsers} change={null} color="green" />
          <StatCard icon={VideoIcon} label="Total Videos" value={stats.totalVideos} change={null} color="blue" />
          <StatCard icon={Flag} label="Pending Reports" value={stats.pendingReports} change={null} color="red" />
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Online Users */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Currently Online</h2>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {onlineUsers.length} active
              </span>
            </div>
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No users active in the last 5 minutes.</p>
            ) : (
              <div className="space-y-4">
                {onlineUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-semibold">
                        {(user.name || 'U')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        {formatDuration(user.duration)}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Active now
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Engagement</h2>
            <div className="space-y-4">
              <RowStat icon={VideoIcon} label="Videos" value={stats.totalVideos} bg="blue" />
              <RowStat icon={MessageSquare} label="Comments" value={stats.totalComments} bg="purple" />
              <RowStat icon={Heart} label="Likes" value={stats.totalLikes} bg="pink" />
            </div>
          </div>
        </div>

        {/* Top Videos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Videos</h2>
          {topVideos.length === 0 ? (
            <p className="text-sm text-gray-500">No analytics in this time window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Video</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Views</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Avg Watch Time</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {topVideos.map((video) => (
                    <tr key={video.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                            <VideoIcon className="w-6 h-6 text-white" />
                          </div>
                          <span className="font-medium text-gray-900">{video.title}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Eye className="w-4 h-4" />
                          {video.views.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">{formatDuration(video.avgWatchTime)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${Math.max(0, Math.min(100, video.completion ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-600">
                            {(Number.isFinite(video.completion) ? video.completion : 0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
            <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              View all reports →
            </button>
          </div>
          {recentReports.length === 0 ? (
            <p className="text-sm text-gray-500">No reports yet.</p>
          ) : (
            <div className="space-y-4">
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition"
                >
                  {/* LEFT: content */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                      <Flag className="w-5 h-5 text-red-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-gray-900 capitalize">{report.type}</span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                          {report.reason}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(report.status)}`}>
                          {report.status.replaceAll('_', ' ')}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mb-1 truncate">
                        Reported by {report.reporter ?? 'unknown'} · About {report.reported ?? 'unknown'} ·{' '}
                        {new Date(report.created_at).toLocaleString()}
                      </p>

                      {report.description && (
                        <p className="text-sm text-gray-600 italic mt-1 line-clamp-2 sm:line-clamp-none">
                          <q>{report.description}</q>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: actions */}
                  <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex flex-wrap sm:flex-nowrap justify-end gap-2">
                    {/* In review */}
                    <button
                      className="p-2 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                      onClick={() => updateReportStatus(report.id, 'reviewed')}
                      disabled={busyReportId === report.id}
                      title="Mark in review"
                      aria-label="Mark in review"
                    >
                      <Clock className="w-5 h-5 text-blue-600" />
                    </button>

                    {/* Dismiss */}
                    <button
                      className="p-2 hover:bg-purple-50 rounded-lg transition disabled:opacity-50"
                      onClick={() => updateReportStatus(report.id, 'dismissed')}
                      disabled={busyReportId === report.id}
                      title="Dismiss"
                      aria-label="Dismiss"
                    >
                      <XCircle className="w-5 h-5 text-purple-600" />
                    </button>

                    {/* Resolve */}
                    <button
                      className="p-2 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                      onClick={() => updateReportStatus(report.id, 'resolved')}
                      disabled={busyReportId === report.id}
                      title="Resolve"
                      aria-label="Resolve"
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </button>
                  </div>
                </div>

              ))}
            </div>
          )}
        </div>
        {/* Invites */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Invites</h2>

            {/* tiny segmented control */}
            <div className="inline-flex items-center rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setInviteFilter('pending')}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition',
                  inviteFilter === 'pending'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                ].join(' ')}
              >
                Pending
                <span className="ml-2 rounded-full bg-gray-100 text-gray-700 text-[11px] px-1.5 py-0.5">
                  {pendingInvites.length}
                </span>
              </button>
              <button
                onClick={() => setInviteFilter('rejected')}
                className={[
                  'ml-1 px-3 py-1.5 rounded-md text-sm font-medium transition',
                  inviteFilter === 'rejected'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                ].join(' ')}
              >
                Rejected
                <span className="ml-2 rounded-full bg-gray-100 text-gray-700 text-[11px] px-1.5 py-0.5">
                  {rejectedInvites.length}
                </span>
              </button>
            </div>
          </div>

          {/* list */}
          {(() => {
            const list = inviteFilter === 'pending' ? pendingInvites : rejectedInvites;

            if (list.length === 0) {
              return (
                <p className="text-sm text-gray-500">
                  {inviteFilter === 'pending' ? 'No invite requests.' : 'No rejected invites.'}
                </p>
              );
            }

            return (
              <div className="space-y-4">
                {list.map((invite) => (
                  <div
                    key={invite.email}
                    className="flex flex-col sm:flex-row sm:items-center p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition overflow-hidden"
                  >
                    {/* LEFT: details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-gray-900 break-words max-w-full">
                          {invite.email}
                        </span>

                        <span
                          className={[
                            'px-2 py-0.5 rounded text-xs font-medium',
                            'mt-1 sm:mt-0',
                            inviteFilter === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          ].join(' ')}
                        >
                          {inviteFilter}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mb-1">
                        {new Date(invite.created_at).toLocaleString()}
                      </p>

                      {invite.reason && (
                        <p className="text-sm text-gray-600 italic line-clamp-2 sm:line-clamp-none">
                          <q>{invite.reason}</q>
                        </p>
                      )}
                    </div>

                    {/* RIGHT: actions */}
                    <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex flex-wrap justify-end gap-2 shrink-0">
                      <button
                        className="p-2 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                        onClick={() => approveInvite(invite.email)}
                        disabled={busyInviteEmail === invite.email}
                        title="Approve"
                      >
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </button>

                      {inviteFilter === 'pending' && (
                        <button
                          className="p-2 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          onClick={() => rejectInvite(invite.email)}
                          disabled={busyInviteEmail === invite.email}
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>

                ))}
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
};

/* ---------------- small UI helpers ---------------- */

const statusBadge = (s: ReportStatus) => {
  const map: Record<ReportStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    dismissed: 'bg-purple-100 text-purple-700'
  };
  return map[s] ?? 'bg-gray-100 text-gray-700';
};



function StatCard({
  icon: Icon,
  label,
  value,
  change,
  color = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  change: number | null;
  color?: 'blue' | 'purple' | 'green' | 'red';
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {typeof change === 'number' && (
          <span className={`text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change > 0 ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</h3>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function RowStat({
  icon: Icon,
  label,
  value,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  bg: 'blue' | 'purple' | 'pink';
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
  };
  return (
    <div className={`flex items-center justify-between p-3 ${colors[bg]} rounded-lg`}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-lg font-bold">{value.toLocaleString()}</span>
    </div>
  );
}

export default AdminDashboard;
