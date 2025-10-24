'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageCircle, 
  Bookmark,
  BookmarkCheck,
  Send, 
  Video as VideoIcon, 
  Trash2, 
  Heart,
  Filter,
  X,
  Play,
  Flag ,
  Pause
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { analytics } from '@/lib/analytics'


import Link from 'next/link';
import { Comments } from '@/components/Comments';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from 'framer-motion'
import { ReportDialog } from '@/components/ReportDialog';


import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import dynamic from 'next/dynamic';
import { CreatePost } from '@/components/CreatePost';

const VideoUpload = dynamic(
  () => import('@/components/VideoUpload').then(m => m.VideoUpload),
  { ssr: false }
);

type Subject = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

type Profile = {
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: Profile | null;
};

type Video = {
  id: string;
  user_id: string;
  title: string;
  mux_playback_id: string;
  mux_asset_id: string;
  subject_id?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: Profile | null;
};

type Post = {
  id: string;
  user_id: string;
  content: string;
  background_image?: string;
  subject_id?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: Profile | null;
};

/** Discriminated union types */
type VideoItem = Video & { type: 'video' }
type PostItem  = Post  & { type: 'post' }
type FeedItem  = VideoItem | PostItem
type FeedClientProps = {
  user: User;
  videoApi?: {
    list: (subjectId: string) => Promise<Video[]>;
  };
  postApi?: {
    list: (subjectId: string) => Promise<Post[]>;
  };
};


export default function FeedClient({   user,
  videoApi,
  postApi,
}: FeedClientProps) {
  const supabase = createClient();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [newMessage, setNewMessage] = useState('');
  const [itemToDelete, setItemToDelete] = useState<FeedItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());



  //const videoStartTimes = useRef<Map<string, number>>(new Map());
  //const videoTotalWatched = useRef<Map<string, number>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const videoViewFired = useRef<Set<string>>(new Set());
  const postViewFired  = useRef<Set<string>>(new Set());
  const analyticsReadyRef = useRef(false);
  //const videoDurationReady = useRef<Set<string>>(new Set());
  //const completionSent = useRef<Set<string>>(new Set());



  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  // Video refs + overlay state
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [overlayVisibleId, setOverlayVisibleId] = useState<string | null>(null);
  const [overlayIcon, setOverlayIcon] = useState<'play' | 'pause'>('play');
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

// one callback that will point to the currently visible scroller
const setScrollerRef = useCallback((el: HTMLDivElement | null) => {
  if (el) setScrollEl(el);
}, []);



  useEffect(() => {
  if (!scrollEl) return;

  const onScroll = () => {
    const nearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 200;
    setShowJumpToBottom(!nearBottom);
  };

  // set initial state
  onScroll();

  scrollEl.addEventListener('scroll', onScroll, { passive: true });
  return () => scrollEl.removeEventListener('scroll', onScroll);
}, [scrollEl]);


useEffect(() => {
  let alive = true;

  (async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u || !alive) return;

    const sessionId = await analytics.startSession(u.id);
    if (!alive) return;

    if (sessionId) {
      setAnalyticsReady(true);

      if (!analyticsReadyRef.current) {
        analytics.setupActivityListeners();
        analyticsReadyRef.current = true;
      }
    }
  })();

  return () => {
  alive = false;
  if (analytics?.endSession) {
    Promise.resolve(analytics.endSession()).catch(() => {});
  }
};
}, [supabase]);



useEffect(() => {
  if (!newMessage) return setIsTyping(false);
  setIsTyping(true);
  const t = setTimeout(() => setIsTyping(false), 1200);
  return () => clearTimeout(t);
}, [newMessage]);

useEffect(() => {
  if (!scrollEl) return;
  const nearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 200;
  if (nearBottom) jumpToBottom();
}, [messages, scrollEl]);



const jumpToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });


  // IntersectionObserver: auto play/pause current video
    useEffect(() => {
      const container = feedContainerRef.current;
      if (!container) return;

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const el = entry.target as HTMLElement;
            const key = el.getAttribute('data-feed-id'); 
            if (!key) return;

            const [kind, rawId] = key.split('-');

            if (kind === 'video') {
              const v = videoRefs.current.get(key);
              if (!v) return;

              if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                v.muted = true;
                v.playsInline = true;
                v.play().catch(() => {});
              } else {
                v.pause();
              }
            } else if (kind === 'post') {
              if (
                analyticsReady &&
                entry.isIntersecting &&
                entry.intersectionRatio >= 0.6 &&
                !postViewFired.current.has(key)
              ) {
                postViewFired.current.add(key);
                const post = posts.find((p) => p.id === rawId);
                (async () => {
                  try {
                    await analytics.trackEvent(user.id, 'post_view', {
                      post_id: rawId,
                      subject_id: post?.subject_id ?? null,
                    });
                  } catch {
                  }
                })();
              }
            }
          });
        },
        { root: container, threshold: [0.0, 0.6, 1.0] }
      );

      const sections = container.querySelectorAll('[data-feed-id]');
      sections.forEach((s) => io.observe(s));

      return () => io.disconnect();
    }, [videos, posts, user.id, analyticsReady]);





  useEffect(() => {
  const container = feedContainerRef.current;
  if (!container) return;

  const handleScroll = () => {
    const currentScrollY = container.scrollTop;
    
    // Hide header when scrolling down, show when scrolling up
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      setHeaderVisible(false);
    } else {
      setHeaderVisible(true);
    }
    
    setLastScrollY(currentScrollY);
  };

  container.addEventListener('scroll', handleScroll, { passive: true });
  return () => container.removeEventListener('scroll', handleScroll);
}, [lastScrollY]);

  const showOverlay = (id: string, icon: 'play' | 'pause') => {
    setOverlayIcon(icon);
    setOverlayVisibleId(id);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setOverlayVisibleId(null), 800);
  };



  const toggleVideoPlay = (id: string) => {
  const v = videoRefs.current.get(id);
  if (!v) return;

  if (v.paused) {
    v.play().catch(() => {});
    showOverlay(id, 'pause');
  } else {
    v.pause();
    showOverlay(id, 'play');
  }
};


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleSave = async (item: FeedItem) => {
  // block saving your own content
  if (item.user_id === user.id) return;

  const key = `${item.type}-${item.id}`;
  const isSaved = savedItems.has(key);
  const column = item.type === 'video' ? 'video_id' : 'post_id';

  try {
    if (isSaved) {
      await supabase
        .from('saves')
        .delete()
        .eq('user_id', user.id)
        .eq(column, item.id);

      setSavedItems(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      await supabase
        .from('saves')
        .insert({ user_id: user.id, [column]: item.id });

      setSavedItems(prev => new Set(prev).add(key));
    }
  } catch (e) {
    console.error('toggleSave error', e);
  }
};



const loadSaved = useCallback(async () => {
  const { data, error } = await supabase
    .from('saves')
    .select('video_id, post_id')
    .eq('user_id', user.id);

  if (error) return;

  const s = new Set<string>();
  (data ?? []).forEach(r => {
    if (r.video_id) s.add(`video-${r.video_id}`);
    if (r.post_id)  s.add(`post-${r.post_id}`);
  });
  setSavedItems(s);
}, [supabase, user.id]);



  // Load subjects
  const loadSubjects = useCallback(async () => {
    const { data } = await supabase
      .from('subjects')
      .select('*')
      .order('name');

    if (data) setSubjects(data);
  }, [supabase]);

  // Load messages
  const loadMessages = useCallback(async () => {
    const { data: messagesData, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error || !messagesData) return;

    const userIds = [...new Set(messagesData.map(m => m.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    setMessages(messagesData.map(msg => ({
      ...msg,
      profiles: profilesMap.get(msg.user_id) || null,
    })));
  }, [supabase]);

  // Load videos
 const loadVideos = useCallback(async () => {
  let query = supabase
    .from('videos')
    .select('*')
    .eq('status', 'ready');

  if (selectedSubject !== 'all') {
    query = query.eq('subject_id', selectedSubject);
  }

  const { data: videosData, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !videosData) return;

  // profiles
  const userIds = [...new Set(videosData.map(v => v.user_id))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);
  const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));

  // comments count
  const videoIds = videosData.map(v => v.id);
  const { data: videoComments } = await supabase
    .from('comments')
    .select('video_id')
    .in('video_id', videoIds);
  const commentsCount = new Map<string, number>();
  (videoComments ?? []).forEach((c: { video_id: string }) => {
    commentsCount.set(c.video_id, (commentsCount.get(c.video_id) ?? 0) + 1);
  });

  // likes count
  const { data: videoLikes } = await supabase
    .from('likes')
    .select('video_id')
    .in('video_id', videoIds);
  const likesCount = new Map<string, number>();
  (videoLikes ?? []).forEach((l: { video_id: string }) => {
    likesCount.set(l.video_id, (likesCount.get(l.video_id) ?? 0) + 1);
  });

  setVideos(
    videosData.map(v => ({
      ...v,
      profiles: profilesMap.get(v.user_id) || null,
      comments_count: commentsCount.get(v.id) ?? 0,
      likes_count: likesCount.get(v.id) ?? 0,
    }))
  );
}, [supabase, selectedSubject]);


  // Load posts
 const loadPosts = useCallback(async () => {
  let query = supabase
    .from('posts')
    .select('*');

  if (selectedSubject !== 'all') {
    query = query.eq('subject_id', selectedSubject);
  }

  const { data: postsData, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !postsData) return;

  // profiles
  const userIds = [...new Set(postsData.map(p => p.user_id))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);
  const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));

  // comments count
  const postIds = postsData.map(p => p.id);
  const { data: postComments } = await supabase
    .from('comments')
    .select('post_id')
    .in('post_id', postIds);
  const commentsCount = new Map<string, number>();
  (postComments ?? []).forEach((c: { post_id: string }) => {
    commentsCount.set(c.post_id, (commentsCount.get(c.post_id) ?? 0) + 1);
  });

  // likes count
  const { data: postLikes } = await supabase
    .from('likes')
    .select('post_id')
    .in('post_id', postIds);
  const likesCount = new Map<string, number>();
  (postLikes ?? []).forEach((l: { post_id: string }) => {
    likesCount.set(l.post_id, (likesCount.get(l.post_id) ?? 0) + 1);
  });

  setPosts(
    postsData.map(p => ({
      ...p,
      profiles: profilesMap.get(p.user_id) || null,
      comments_count: commentsCount.get(p.id) ?? 0,
      likes_count: likesCount.get(p.id) ?? 0,
    }))
  );
}, [supabase, selectedSubject]);


  // Load user's likes
  const loadLikes = useCallback(async () => {
    const { data } = await supabase
      .from('likes')
      .select('post_id, video_id')
      .eq('user_id', user.id);

    if (data) {
      const liked = new Set<string>();
      data.forEach(like => {
        if (like.post_id) liked.add(`post-${like.post_id}`);
        if (like.video_id) liked.add(`video-${like.video_id}`);
      });
      setLikedItems(liked);
    }
  }, [supabase, user.id]);

  // Combined feed (videos + posts)
  const feedItems: FeedItem[] = [
    ...videos.map(v => ({ ...v, type: 'video' as const })),
    ...posts.map(p => ({ ...p, type: 'post' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


const toggleLike = async (item: FeedItem) => {
  const key = `${item.type}-${item.id}`;
  const isLiked = likedItems.has(key);

  try {
    if (isLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq(item.type === 'video' ? 'video_id' : 'post_id', item.id);

      setLikedItems(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      await supabase
        .from('likes')
        .insert({
          user_id: user.id,
          [item.type === 'video' ? 'video_id' : 'post_id']: item.id,
        });

      setLikedItems(prev => new Set(prev).add(key));
    }

    // Refresh counts + the "liked" state
    await Promise.all([
      item.type === 'video' ? loadVideos() : loadPosts(),
      loadLikes(),
    ]);
  } catch (e) {
    console.error('toggleLike error', e);
  }
};


  // Delete item (narrow by type)
  const deleteItem = async (item: FeedItem) => {
    setDeleting(true);
    try {
      if (item.type === 'video') {
        const v = item as VideoItem;
        await supabase.storage.from('videos').remove([v.mux_asset_id]);
        await supabase.from('videos').delete().eq('id', v.id);
        await loadVideos();
      } else {
        const p = item as PostItem;
        await supabase.from('posts').delete().eq('id', p.id);
        await loadPosts();
      }
      setItemToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadSubjects();
    loadMessages();
    loadVideos();
    loadPosts();
    loadLikes();
    loadSaved();

    const messagesChannel = supabase
      .channel('messages-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadMessages)
      .subscribe();

    const videosChannel = supabase
      .channel('videos-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, loadVideos)
      .subscribe();

    const postsChannel = supabase
      .channel('posts-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadPosts)
      .subscribe();

    const commentsChannel = supabase
    .channel('comments-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
      loadVideos();
      loadPosts();
    })
    .subscribe();

    const presenceChannel = supabase
      .channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.values(state).forEach((presences) => {
          if (Array.isArray(presences)) {
            presences.forEach((presence) => {
              if (presence && typeof presence === 'object' && 'user_id' in presence) {
                online.add(presence.user_id as string);
              }
            });
          }
        });
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(commentsChannel); 
      supabase.removeChannel(presenceChannel);
    };
   }, [supabase, loadSubjects, loadMessages, loadVideos, loadPosts, loadLikes, loadSaved, user.id]);
  
   useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await supabase.from('messages').insert({ user_id: user.id, content: newMessage.trim() });
    setNewMessage('');
    loadMessages();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const formatTime = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  const userInitial = (user.email || 'U')[0]?.toUpperCase();

  const groupByDay = (items: Message[]) => {
  const map = new Map<string, Message[]>();
  items.forEach(m => {
    const d = new Date(m.created_at);
    const key = d.toLocaleDateString();
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  });
  return Array.from(map.entries()); 
};

const _videoApi = videoApi ?? {
    list: async (subjectId: string) => {
      let q = supabase.from('videos').select('*').eq('status', 'ready');
      if (subjectId !== 'all') q = q.eq('subject_id', subjectId);
      const { data } = await q.order('created_at', { ascending: false }).limit(20);
      return data ?? [];
    },
  };

  const _postApi = postApi ?? {
    list: async (subjectId: string) => {
      let q = supabase.from('posts').select('*');
      if (subjectId !== 'all') q = q.eq('subject_id', subjectId);
      const { data } = await q.order('created_at', { ascending: false }).limit(20);
      return data ?? [];
    },
  };

  return (
  <div className="flex flex-col h-screen bg-gray-50" data-testid="feed-root">
    {/* Header with auto-hide */}
      <header
            className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ${
              headerVisible ? 'translate-y-0' : '-translate-y-full'
            }`}
            data-testid="feed-header"
          >
            {/* Top bar */}
            <div className="h-[60px] flex items-center justify-between px-4 md:px-8
                            bg-white/70 supports-[backdrop-filter]:backdrop-blur-xl
                            border-b border-black/5">
              {/* Brand */}
              <div className="flex items-center gap-3" data-testid="brand">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center shadow-sm">
                  <VideoIcon className="w-5 h-5 text-white" />
                </div>
                <div className="leading-tight">
                  <h1 className="text-lg md:text-xl font-bold tracking-tight">SchoolFeed</h1>
                  <p className="text-[11px] text-gray-500 hidden md:block">Learn • Share • Shine</p>
                </div>
              </div>

              {/* Search (desktop) */}
              <button
                type="button"
                className="hidden md:flex group items-center gap-2 h-10 w-[340px] rounded-xl
                          bg-white/70 border border-black/5 px-3 text-sm text-gray-600
                          hover:border-gray-300 transition"
                aria-label="Open search" data-testid="btn-open-search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-70">
                  <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5l1.5-1.5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14"/>
                </svg>
                <span className="text-gray-500">Search posts, videos, people…</span>
                <span className="ml-auto text-[10px] text-gray-400 border px-1.5 py-0.5 rounded-md">⌘K</span>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {/* Open chat (mobile) */}
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileChatOpen(true)} data-testid="btn-open-chat-mobile">
                  <MessageCircle className="w-5 h-5" />
                </Button>

                {/* Filter drawer */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open filters" data-testid="btn-open-filters">
                      <Filter className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>

                  {/* Compact mobile filter content */}
                  <SheetContent side="right" className="w-full sm:max-w-sm" data-testid="filters-sheet">
                    <SheetHeader>
                      <SheetTitle>Filter by Subject</SheetTitle>
                    </SheetHeader>

                    {/* Pills: All + Clear */}
                    <div className="mt-4">
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setSelectedSubject('all')}
                          data-testid="subjects-all"
                          className={`h-9 px-3 rounded-full border text-sm shrink-0
                            ${selectedSubject === 'all'
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white border-black/10 text-gray-700 active:bg-gray-50'}`}
                        >
                          All
                        </button>

                        <button
                          onClick={() => setSelectedSubject('all')}
                          className="h-9 px-3 rounded-full border text-sm text-gray-600 bg-white border-black/10 active:bg-gray-50"
                          data-testid="subjects-clear"
                        >
                          Clear
                        </button>
                      </div>

                      {/* Subjects grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {subjects.map((s) => {
                          const active = selectedSubject === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSubject(s.id)}
                              data-testid={`subjects-pill-${s.id}`}
                              title={s.name}
                              className={`h-9 px-3 rounded-full border text-sm text-left truncate
                                ${active
                                  ? 'text-white border-transparent'
                                  : 'bg-white text-gray-800 border-black/10 active:bg-gray-50'}`}
                              style={active ? { backgroundColor: s.color } : {}}
                            >
                              <span className="inline-flex items-center gap-2 truncate">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                <span className="truncate">{s.icon} {s.name}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6 flex gap-2">
                      <Button className="flex-1 h-9 rounded-full" data-testid="filters-done" onClick={() => {/*  */}}>
                        Done
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-9 rounded-full"
                        onClick={() => setSelectedSubject('all')}
                      >
                        Reset
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Notifications (placeholder) */}
                <div className="relative">
                  <Button variant="ghost" size="icon" aria-label="Notifications" data-testid="btn-notifications">
                    <Heart className="w-5 h-5" />
                  </Button>
                  <span className="absolute right-2 top-2 w-2 h-2 rounded-full bg-rose-500" />
                </div>

                {/* User menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="outline-none rounded-full focus-visible:ring-2 focus-visible:ring-purple-500"
                      aria-label="Open user menu"
                      data-testid="btn-user-menu"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src="" alt={user.email ?? 'user'} />
                        <AvatarFallback>{userInitial}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                    <DropdownMenuLabel className="truncate">{user.email ?? 'Account'}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/profile/${user.id}`} className="w-full" data-testid="menu-profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600" data-testid="menu-logout">
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Subject strip with fades  */}
    <div className="relative bg-white/60 supports-[backdrop-filter]:backdrop-blur-xl border-b border-black/5">
      {/* edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-white/60 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white/60 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="py-2 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {/* All pill */}
          <button
            onClick={() => setSelectedSubject('all')}
            data-testid="subjects-all"
            className={`h-9 px-3 rounded-full border text-sm shrink-0 snap-start
              ${selectedSubject === 'all'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white/80 text-gray-800 border-black/10 hover:bg-white active:bg-gray-50'}`}
          >
            All
          </button>

          {/* Subjects */}
          {subjects.map((s) => {
            const active = selectedSubject === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.id)}
                data-testid={`subjects-top-pill-${s.id}`} 
                className={`h-9 px-3 rounded-full border text-sm shrink-0 snap-start max-w-[55vw] md:max-w-none
                  ${active
                    ? 'text-white border-transparent'
                    : 'bg-white/80 text-gray-800 border-black/10 hover:bg-white active:bg-gray-50'}`}
                style={active ? { backgroundColor: s.color } : {}}
                title={s.name}
              >
                <span className="inline-flex items-center gap-1.5 truncate leading-none">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.icon} {s.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
      </header>


    {/* Main Content */}
    <div className="flex flex-1 overflow-hidden">
      {/* Feed - Full Screen */}
      <main className="flex-1 overflow-hidden relative">
        {/* Floating Action Buttons */}
        <div className="absolute bottom-6 right-6 z-20 md:z-30 flex flex-col gap-3 pointer-events-none">
          <div className="pointer-events-auto" data-testid="fab-video-upload">
            <VideoUpload userId={user.id} subjects={subjects} onUploadSuccess={loadVideos} />
          </div>
          <div className="pointer-events-auto" data-testid="fab-create-post">
            <CreatePost userId={user.id} subjects={subjects} onPostCreated={loadPosts} />
          </div>
        </div>

        {/* Scrollable Feed */}
        <div
          ref={feedContainerRef}
          data-testid="feed-container"
          className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth scrollbar-hide"
        >
          {feedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center" data-testid="empty-state">
              <VideoIcon className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg mb-2">No content yet</p>
              <p className="text-sm text-gray-400 mb-6">
                Be the first to share something!
              </p>
              <div className="flex gap-3" data-testid="fab-group">
                <VideoUpload userId={user.id} subjects={subjects} onUploadSuccess={loadVideos} />
                <CreatePost userId={user.id} subjects={subjects} onPostCreated={loadPosts} />
              </div>
            </div>
          ) : (
            feedItems.map((item) => (
              <section
                key={`${item.type}-${item.id}`}
                data-feed-id={`${item.type}-${item.id}`}
                className="h-screen snap-start flex items-center justify-center bg-black relative"
              >
                {item.type === 'video' ? (
                  (() => {
                    const v = item as VideoItem;
                    return (
                      <div 
                        className="relative w-full h-full flex items-center justify-center"
                        onTouchStart={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'VIDEO') {
                            e.stopPropagation();
                          }
                        }}
                      >
                    {/* Video */}
                     <video
                      ref={(el) => {
                        const key = `${item.type}-${item.id}`;
                        
                        if (el) {
                          videoRefs.current.set(key, el);

                          // Clear old listeners
                          el.onplay = null;
                          el.onpause = null;
                          el.onended = null;
                          el.ontimeupdate = null;
                          el.onloadedmetadata = null;

                          let updateTimer: NodeJS.Timeout | null = null;

                          el.onloadedmetadata = () => {
                            console.log('📹 Video loaded:', v.id, 'duration:', Math.floor(el.duration));
                          };

                          // Track view once on first play
                          el.onplay = async () => {
                            if (!videoViewFired.current.has(key) && analyticsReady) {
                              videoViewFired.current.add(key);
                              try {
                                await analytics.trackVideoView(user.id, v.id);
                                console.log('✅ View tracked:', v.id);
                              } catch (err) {
                                console.error('❌ View track failed:', err);
                              }
                            }

                            // Start periodic updates every 2 seconds while playing
                            if (updateTimer) clearInterval(updateTimer);
                            
                            updateTimer = setInterval(async () => {
                              if (el.paused || !el.duration) return;
                              
                              const pos = Math.floor(el.currentTime);
                              const dur = Math.floor(el.duration);
                              
                              if (dur > 0 && analyticsReady) {
                                try {
                                  await analytics.trackVideoWatchTime(user.id, v.id, pos, pos, dur);
                                  console.log('📊', v.id.slice(0,8), `${pos}/${dur}s`, `${Math.round(pos/dur*100)}%`);
                                } catch (err) {
                                  console.error('❌ Track failed:', err);
                                }
                              }
                            }, 2000);
                          };

                          // Stop updates when paused
                          el.onpause = () => {
                            if (updateTimer) {
                              clearInterval(updateTimer);
                              updateTimer = null;
                            }
                            
                            // Send final update
                            const pos = Math.floor(el.currentTime);
                            const dur = Math.floor(el.duration);
                            if (dur > 0 && analyticsReady) {
                              analytics.trackVideoWatchTime(user.id, v.id, pos, pos, dur)
                                .then(() => console.log('⏸️ Pause update:', v.id.slice(0,8)))
                                .catch(err => console.error('❌', err));
                            }
                          };

                          // Send final update when video ends
                          el.onended = () => {
                            if (updateTimer) {
                              clearInterval(updateTimer);
                              updateTimer = null;
                            }
                            
                            const dur = Math.floor(el.duration);
                            if (dur > 0 && analyticsReady) {
                              // Video ended = 100% watched
                              analytics.trackVideoWatchTime(user.id, v.id, dur, dur, dur)
                                .then(() => console.log('🏁 End update:', v.id.slice(0,8)))
                                .catch(err => console.error('❌', err));
                            }
                          };

                        } else {
                          // Cleanup
                          videoRefs.current.delete(key);
                          videoViewFired.current.delete(key);
                        }
                      }}
                      src={v.mux_playback_id}
                      className="max-h-full max-w-full"
                      muted
                      playsInline
                      loop
                      data-testid={`video-${v.id}`} 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVideoPlay(`${item.type}-${item.id}`);
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        toggleVideoPlay(`${item.type}-${item.id}`);
                      }}
                    />


                        {/* Center Play/Pause overlay icon */}
                        <div
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                            overlayVisibleId === `${item.type}-${item.id}` ? 'opacity-100' : 'opacity-0'
                          }`}
                          data-testid={`video-overlay-${v.id}`}
                        >
                          <div className="bg-black/40 rounded-full p-4">
                            {overlayIcon === 'play' ? (
                              <Play className="w-14 h-14 text-white" />
                            ) : (
                              <Pause className="w-14 h-14 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    const p = item as PostItem;
                    return (
                      <div
                        className="w-full h-full flex items-center justify-center p-8"
                        data-testid={`post-bg-${item.id}`}
                        style={{
                          backgroundImage: p.background_image
                            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${p.background_image})`
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        <p className="text-white text-2xl md:text-4xl font-bold text-center max-w-2xl leading-relaxed" data-testid={`post-content-${item.id}`}>
                          {p.content}
                        </p>
                      </div>
                    );
                  })()
                )}

                {/* Actions Sidebar (left center) */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-40 pointer-events-none">
                  {/* Like button */}
                  <div className="pointer-events-auto">
                    <button
                      onClick={() => toggleLike(item)}
                      aria-label="Like"
                      className="flex flex-col items-center"
                      data-testid={`like-btn-${item.id}`} 
                    >
                      <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition">
                        <Heart
                          className={`w-7 h-7 ${
                            likedItems.has(`${item.type}-${item.id}`)
                              ? 'fill-red-500 text-red-500'
                              : 'text-white'
                          }`}
                        />
                      </div>
                      <span className="text-white text-xs mt-1 font-semibold" data-testid={`like-count-${item.id}`}>
                        {item.likes_count}
                      </span>
                    </button>
                  </div>

                  {/* Save / Unsave (videos & posts) */}
                    <div className="pointer-events-auto">
                      <button
                        onClick={() => toggleSave(item)}
                        aria-label="Save"
                        disabled={item.user_id === user.id}  
                        className="flex flex-col items-center disabled:opacity-50"
                        data-testid={`save-btn-${item.id}`}
                      >
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition">
                          {savedItems.has(`${item.type}-${item.id}`) ? (
                            <BookmarkCheck className="w-7 h-7 text-white" />
                          ) : (
                            <Bookmark className="w-7 h-7 text-white" />
                          )}
                        </div>
                        <span className="text-white text-xs mt-1 font-semibold">
                          {item.user_id === user.id
                            ? 'Yours'
                            : savedItems.has(`${item.type}-${item.id}`) ? 'Saved' : 'Save'}
                        </span>
                      </button>
                    </div>


                  {/* Comments */}
                  <div className="pointer-events-auto" data-testid={`comments-${item.id}`}>
                    <Comments
                      itemId={item.id}
                      itemType={item.type}
                      userId={user.id}
                      commentsCount={item.comments_count}
                      onCountChange={(newCount) => {
                        if (item.type === 'video') {
                          setVideos(prev =>
                            prev.map(v => v.id === item.id ? { ...v, comments_count: newCount } : v)
                          );
                        } else {
                          setPosts(prev =>
                            prev.map(p => p.id === item.id ? { ...p, comments_count: newCount } : p)
                          );
                        }
                      }}
                    />
                  </div>

                  {/* Profile shortcut button (mobile only) */}
                  <div className="pointer-events-auto md:hidden">
                    <Link
                      href={`/profile/${item.user_id}`}
                      className="flex flex-col items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full hover:bg-white/30 transition">
                        <Avatar className="w-8 h-8 border-2 border-white">
                          <AvatarFallback className="text-xs">
                            {(item.profiles?.username || item.profiles?.email || 'U')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </Link>
                  </div>

                   {/* Report Button - only show if NOT your own content */}
                    {item.user_id !== user.id && (
                      <div className="pointer-events-auto">
                        <ReportDialog
                          reportedUserId={item.user_id}
                          reportedContentId={item.id}
                          contentType={item.type}
                          reporterUserId={user.id}
                          trigger={
                            <button className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-red-500/80 transition" data-testid={`report-btn-${item.id}`}>
                              <Flag className="w-7 h-7 text-white" />
                            </button>
                          }
                        />
                      </div>
                    )}

                  {/* Delete (own content) */}
                  {item.user_id === user.id && (
                    <div className="pointer-events-auto">
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-red-500 transition"
                        data-testid={`delete-btn-${item.id}`} 
                      >
                        <Trash2 className="w-7 h-7 text-white" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Info Overlay (bottom) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 md:p-6 pl-20 md:pl-24" data-testid={`info-${item.type}-${item.id}`}>
                  <div className="max-w-4xl">
                    {item.type === 'video' && (
                      <h3 className="text-white font-semibold text-base md:text-lg mb-2 line-clamp-2">
                        {(item as VideoItem).title}
                      </h3>
                    )}
                    
                    {/* User Info - Larger touch area for mobile */}
                    <Link
                      href={`/profile/${item.user_id}`}
                      className="flex items-center gap-3 mb-3 active:opacity-70 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      data-testid={`user-link-${item.user_id}`}
                    >
                      <Avatar className="w-10 h-10 md:w-12 md:h-12 border-2 border-white flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {(item.profiles?.username || item.profiles?.email || 'U')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm md:text-base truncate">
                          {item.profiles?.username || item.profiles?.email || 'Anonymous'}
                        </p>
                        <p className="text-white/70 text-xs md:text-sm">
                          {formatTime(item.created_at)}
                        </p>
                      </div>
                    </Link>

                    {/* Subject Badge */}
                    {item.subject_id && (
                      <Badge
                        style={{
                          backgroundColor: subjects.find(s => s.id === item.subject_id)?.color,
                        }}
                        className="text-white text-xs"
                        data-testid={`subject-badge-${item.subject_id}`}
                      >
                        {subjects.find(s => s.id === item.subject_id)?.icon}{' '}
                        {subjects.find(s => s.id === item.subject_id)?.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {/* Desktop Chat — modern glass panel */}
          <aside className="relative hidden md:flex w-[24rem] border-l bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 flex-col h-full" data-testid="chat-desktop">
            {/* Header */}
            <div className="border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold leading-tight">School Chat</h3>
                  <p className="text-xs text-gray-500 -mt-0.5">Classwide messages</p>
                </div>
              </div>
              <Badge variant="secondary" data-testid="chat-count" >{messages.length}</Badge>
            </div>

            {/* Messages scroller */}
            <div
              ref={!mobileChatOpen ? setScrollerRef : undefined}
              className="flex-1 overflow-y-auto p-4 space-y-6"
              data-testid="chat-messages"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 grid place-items-center mb-4">
                    <MessageCircle className="w-7 h-7 text-purple-500" />
                  </div>
                  <p className="text-gray-600 font-medium">No messages yet</p>
                  <p className="text-gray-400 text-sm">Be the first to say hi 👋</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {groupByDay(messages).map(([date, chunk]) => (
                    <motion.div key={date} layout className="space-y-3">
                      {/* Date chip */}
                      <div className="sticky top-0 z-10 flex justify-center">
                        <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-black/5 shadow-sm text-gray-600 backdrop-blur">
                          {date}
                        </span>
                      </div>

                      {/* Message bubbles  */}
                      {chunk.map((m) => {
                        const isOwn = m.user_id === user.id;
                        const senderName = m.profiles?.username || m.profiles?.email || 'User';
                        const initial = senderName[0]?.toUpperCase();

                        return (
                          <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[80%] md:max-w-[75%]">
                              {!isOwn && (
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-xs grid place-items-center">
                                    {initial}
                                  </div>
                                  <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                                      {senderName}
                                      {onlineUsers.has(m.user_id) && (
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online" />
                                      )}
                                    </span>
                                   {/* report button  */}
                                    <ReportDialog
                                      reportedUserId={m.user_id}
                                      reportedContentId={m.id}
                                      contentType="message"
                                      reporterUserId={user.id}
                                      trigger={
                                        <button className="ml-auto text-gray-400 hover:text-red-500 transition">
                                          <Flag className="w-3 h-3" />
                                        </button>
                                      }
                                    />
                                </div>
                              )}

                              <div
                                className={[
                                  "px-4 py-2 rounded-2xl shadow-sm backdrop-blur",
                                  isOwn
                                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-sm"
                                    : "bg-white/80 text-gray-900 border border-black/5 rounded-tl-sm"
                                ].join(' ')}
                              >
                                <p className="text-sm leading-relaxed">{m.content}</p>
                                <span className={`block mt-1 text-[10px] ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                                  {formatTime(m.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {/* Stick target for "jump to bottom" */}
              <div ref={messagesEndRef} data-testid="chat-end" />
            </div>

            {/* Jump-to-bottom (desktop) */}
            {showJumpToBottom && (
              <button
                onClick={jumpToBottom}
                className="absolute bottom-20 right-4 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs shadow-lg"
                aria-label="Jump to newest"
                data-testid="chat-jump"
              >
                New messages ↓
              </button>
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div className="px-4 pb-2 text-gray-500 text-xs flex items-center gap-2" data-testid="chat-typing">
                <div className="w-5 h-5 rounded-full bg-white/80 border border-black/5 grid place-items-center">
                  <span className="animate-pulse">…</span>
                </div>
                Someone is typing
              </div>
            )}

            {/* Composer */}
            <div className="border-t p-3">
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-2 py-2 rounded-xl shadow-sm border border-black/5">
                <Input
                  placeholder="Write a message…"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="border-0 bg-transparent focus-visible:ring-0"
                  data-testid="chat-input"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon" className="rounded-xl">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </aside>


    </div>

   {/* Mobile Chat — full-screen sheet */}
{mobileChatOpen && (
  <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-gradient-to-b from-white via-white/80 to-white/70 backdrop-blur-xl" data-testid="chat-mobile">
    {/* Header */}
    <div className="border-b p-4 flex items-center justify-between bg-white/80 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 grid place-items-center text-white shadow">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">School Chat</h3>
          <Badge variant="secondary" className="ml-0 mt-0.5">{messages.length}</Badge>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => setMobileChatOpen(false)}>
        <X className="w-4 h-4 mr-1" /> Close
      </Button>
    </div>

    {/* Messages scroller */}
    <div
      ref={mobileChatOpen ? setScrollerRef : undefined}
      className="relative flex-1 overflow-y-auto p-4 space-y-6"
    >
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 grid place-items-center mb-4">
            <MessageCircle className="w-7 h-7 text-purple-500" />
          </div>
          <p className="text-gray-600 font-medium">No messages yet</p>
          <p className="text-gray-400 text-sm">Say hi 👋</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {groupByDay(messages).map(([date, chunk]) => (
            <motion.div key={date} layout className="space-y-3">
              {/* Date chip */}
              <div className="sticky top-0 z-10 flex justify-center">
                <span className="text-[11px] px-3 py-1 rounded-full bg-white/80 border border-black/5 shadow-sm text-gray-600 backdrop-blur">
                  {date}
                </span>
              </div>

              {/* Simple bubbles */}
              {chunk.map((m) => {
                const isOwn = m.user_id === user.id;
                const senderName = m.profiles?.username || m.profiles?.email || 'User';
                const initial = senderName[0]?.toUpperCase();

                return (
                  <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%]">
                      {!isOwn && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-xs grid place-items-center">
                            {initial}
                          </div>
                          <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                              {senderName}
                              {onlineUsers.has(m.user_id) && (
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online" />
                              )}
                            </span>
                           {/* report button  */}
                                    <ReportDialog
                                      reportedUserId={m.user_id}
                                      reportedContentId={m.id}
                                      contentType="message"
                                      reporterUserId={user.id}
                                      trigger={
                                        <button className="ml-auto text-gray-400 hover:text-red-500 transition">
                                          <Flag className="w-3 h-3" />
                                        </button>
                                      }
                                    />
                        </div>
                      )}
                      <div
                        className={[
                          "px-4 py-2 rounded-2xl shadow-sm backdrop-blur",
                          isOwn
                            ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-sm"
                            : "bg-white/80 text-gray-900 border border-black/5 rounded-tl-sm"
                        ].join(' ')}
                      >
                        <p className="text-sm leading-relaxed">{m.content}</p>
                        <span className={`block mt-1 text-[10px] ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {/* Stick target for jump-to-bottom */}
      <div ref={messagesEndRef} data-testid="chat-end-mobile" />
    </div>

    {/* Jump-to-bottom (mobile) */}
    {showJumpToBottom && (
      <button
        onClick={jumpToBottom}
        className="absolute bottom-24 right-4 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs shadow-lg"
        aria-label="Jump to newest"
        data-testid="chat-jump-mobile"
      >
        New messages ↓
      </button>
    )}

    {/* Typing indicator */}
    {isTyping && (
      <div className="px-4 pt-1 pb-2 text-gray-500 text-xs flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-white/80 border border-black/5 grid place-items-center">
          <span className="animate-pulse">…</span>
        </div>
        Someone is typing
      </div>
    )}

    {/* Composer */}
    <div className="border-t p-3 bg-white/80 backdrop-blur">
      <div className="flex items-center gap-2 bg-white px-2 py-2 rounded-xl shadow-sm border border-black/5">
        <Input
          placeholder="Write a message…"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          className="border-0 bg-transparent focus-visible:ring-0"
          data-testid="chat-input-mobile"
        />
        <Button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          size="icon"
          className="rounded-xl"
          data-testid="chat-send-mobile"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
)}



    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!itemToDelete} onOpenChange={(open) => { if (!open) setItemToDelete(null); }}>
      <AlertDialogContent data-testid="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} data-testid="delete-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => itemToDelete && deleteItem(itemToDelete)}
            disabled={deleting}
            className="bg-red-500 hover:bg-red-600"
            data-testid="delete-confirm"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
}
