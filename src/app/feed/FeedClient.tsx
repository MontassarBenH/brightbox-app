'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  Video as VideoIcon, 
  Trash2, 
  Heart,
  Filter,
  X,
  Play,
  Pause
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import Link from 'next/link';
import { Comments } from '@/components/Comments';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

export default function FeedClient({ user }: { user: User }) {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Video refs + overlay state
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [overlayVisibleId, setOverlayVisibleId] = useState<string | null>(null);
  const [overlayIcon, setOverlayIcon] = useState<'play' | 'pause'>('play');
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // IntersectionObserver: auto play/pause current video
  useEffect(() => {
  const container = feedContainerRef.current;
  if (!container) return;

  const io = new IntersectionObserver(
    (entries) => {
      const now = Date.now();

      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;
        const id = el.getAttribute('data-feed-id');
        if (!id) return;

        const v = videoRefs.current.get(id);
        if (!v) return;

        // If we just toggled this video manually, don't let the observer fight it
        if (justToggledRef.current && justToggledRef.current.id === id && now < justToggledRef.current.until) {
          return;
        }

        // Be more forgiving on mobile: ~30% visible is enough to "enter"
        const isIn = entry.isIntersecting && entry.intersectionRatio >= 0.3;

        if (isIn) {
          // start from the beginning each time it enters view
          try { v.pause(); v.currentTime = 0; } catch {}
          v.muted = true;
          v.playsInline = true;
          v.setAttribute('playsinline', '');
          v.setAttribute('webkit-playsinline', '');
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    },
    {
      root: container,
      threshold: [0.0, 0.3, 0.6, 1.0],
      // narrow focus area so the "middle-ish" section counts as in-view earlier
      rootMargin: '-10% 0px -10% 0px',
    }
  );

  const sections = container.querySelectorAll('[data-feed-id]');
  sections.forEach((s) => io.observe(s));
  return () => io.disconnect();
}, [videos, posts]);


    useEffect(() => {
  const onFirstPointer = () => {
    const container = feedContainerRef.current;
    if (!container) return;

    // Strongly-typed NodeList
    const sections = Array.from(
      container.querySelectorAll<HTMLElement>('[data-feed-id]')
    );

    const middle = container.scrollTop + container.clientHeight / 2;

    // Track just the id instead of the element
    let bestId: string | null = null;
    let bestDelta = Infinity;

    for (const s of sections) {
      const rect = s.getBoundingClientRect();
      const top = rect.top + container.scrollTop;
      const center = top + rect.height / 2;
      const delta = Math.abs(center - middle);
      if (delta < bestDelta) {
        bestDelta = delta;
        // prefer dataset when available
        bestId = s.dataset.feedId ?? s.getAttribute('data-feed-id');
      }
    }

    if (bestId) {
      const v = videoRefs.current.get(bestId);
      if (v) {
        v.muted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        try { v.currentTime = 0; } catch {}
        v.play().catch(() => {});
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onFirstPointer, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', onFirstPointer);
  }
}, []);



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

  const justToggledRef = useRef<{ id: string; until: number } | null>(null);


  const toggleVideoPlay = (id: string) => {
  const v = videoRefs.current.get(id);
  if (!v) return;

  // give a short grace period where the observer won't pause this video
  justToggledRef.current = { id, until: Date.now() + 600 };

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

  // Toggle like
  // Toggle like — only touch the likes table, then reload counts
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

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(commentsChannel); 
    };
  }, [supabase, loadSubjects, loadMessages, loadVideos, loadPosts, loadLikes]);

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

  return (
  <div className="flex flex-col h-screen bg-gray-50">
    {/* Header with auto-hide */}
    <header 
      className={`bg-white border-b fixed top-0 left-0 right-0 z-40 px-4 py-3 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
            <VideoIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            SchoolFeed
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileChatOpen(true)}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Filter className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filter by Subject</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                <Button
                  variant={selectedSubject === 'all' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setSelectedSubject('all')}
                >
                  All Subjects
                </Button>
                {subjects.map((subject) => (
                  <Button
                    key={subject.id}
                    variant={selectedSubject === subject.id ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setSelectedSubject(subject.id)}
                  >
                    <span className="mr-2">{subject.icon}</span>
                    {subject.name}
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <Avatar className="w-8 h-8 cursor-pointer" onClick={handleLogout}>
            <AvatarImage src="" alt={user.email ?? 'user'} />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Subject Pills */}
      <div className="max-w-6xl mx-auto mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Badge
          variant={selectedSubject === 'all' ? 'default' : 'outline'}
          className="cursor-pointer whitespace-nowrap"
          onClick={() => setSelectedSubject('all')}
        >
          All
        </Badge>
        {subjects.map((subject) => (
          <Badge
            key={subject.id}
            variant={selectedSubject === subject.id ? 'default' : 'outline'}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setSelectedSubject(subject.id)}
            style={{
              backgroundColor: selectedSubject === subject.id ? subject.color : undefined,
            }}
          >
            {subject.icon} {subject.name}
          </Badge>
        ))}
      </div>
    </header>

    {/* Main Content */}
    <div className="flex flex-1 overflow-hidden">
      {/* Feed - Full Screen */}
      <main className="flex-1 overflow-hidden relative">
        {/* Floating Action Buttons */}
        <div className="absolute bottom-6 right-6 z-20 md:z-30 flex flex-col gap-3 pointer-events-none">
          <div className="pointer-events-auto">
            <VideoUpload userId={user.id} onUploadSuccess={loadVideos} />
          </div>
          <div className="pointer-events-auto">
            <CreatePost userId={user.id} subjects={subjects} onPostCreated={loadPosts} />
          </div>
        </div>

        {/* Scrollable Feed */}
        <div
          ref={feedContainerRef}
          className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth scrollbar-hide"
        >
          {feedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <VideoIcon className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg mb-2">No content yet</p>
              <p className="text-sm text-gray-400 mb-6">
                Be the first to share something!
              </p>
              <div className="flex gap-3">
                <VideoUpload userId={user.id} onUploadSuccess={loadVideos} />
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
                            if (el) videoRefs.current.set(`${item.type}-${item.id}`, el);
                            else videoRefs.current.delete(`${item.type}-${item.id}`);
                          }}
                          src={v.mux_playback_id}
                          className="max-h-full max-w-full"
                        
                          autoPlay
                          muted
                          playsInline
                     
                          loop
                          controls={false}
                          preload="auto"
                         onClick={(e) => { e.stopPropagation(); toggleVideoPlay(`${item.type}-${item.id}`); }}
                         onTouchEnd={(e) => { e.stopPropagation(); toggleVideoPlay(`${item.type}-${item.id}`); }}
                        />


                        {/* Center Play/Pause overlay icon */}
                        <div
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                            overlayVisibleId === `${item.type}-${item.id}` ? 'opacity-100' : 'opacity-0'
                          }`}
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
                        style={{
                          backgroundImage: p.background_image
                            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${p.background_image})`
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        <p className="text-white text-2xl md:text-4xl font-bold text-center max-w-2xl leading-relaxed">
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
                      className="flex flex-col items-center"
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
                      <span className="text-white text-xs mt-1 font-semibold">
                        {item.likes_count}
                      </span>
                    </button>
                  </div>

                  {/* Comments */}
                  <div className="pointer-events-auto">
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

                  {/* Delete (own content) */}
                  {item.user_id === user.id && (
                    <div className="pointer-events-auto">
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-red-500 transition"
                      >
                        <Trash2 className="w-7 h-7 text-white" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Info Overlay (bottom) - Better mobile touch targets */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 md:p-6 pl-20 md:pl-24">
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

      {/* Desktop Chat */}
      <aside className="hidden md:flex w-96 border-l bg-white flex-col h-full">
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold">School Chat</h3>
          </div>
          <Badge variant="secondary">{messages.length}</Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-8">
              No messages yet. Say hi! 👋
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = m.user_id === user.id;
              const senderName = m.profiles?.username || m.profiles?.email || 'User';
              const initial = senderName[0]?.toUpperCase();

              return (
                <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg ${
                      isOwn
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {!isOwn && (
                      <div className="flex items-center mb-1">
                        <Avatar className="w-6 h-6 mr-2">
                          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-semibold text-gray-500">{senderName}</p>
                      </div>
                    )}
                    <p className="text-sm">{m.content}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-purple-200' : 'text-gray-500'}`}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </div>

    {/* Mobile Chat Overlay */}
    {mobileChatOpen && (
      <div className="fixed inset-0 z-50 bg-white md:hidden flex flex-col">
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold">School Chat</h3>
            <Badge variant="secondary" className="ml-2">{messages.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => setMobileChatOpen(false)}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-8">
              No messages yet. Say hi! 👋
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = m.user_id === user.id;
              const senderName = m.profiles?.username || m.profiles?.email || 'User';
              const initial = senderName[0]?.toUpperCase();
              return (
                <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-2 rounded-lg ${
                      isOwn
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {!isOwn && (
                      <div className="flex items-center mb-1">
                        <Avatar className="w-6 h-6 mr-2">
                          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-semibold text-gray-500">{senderName}</p>
                      </div>
                    )}
                    <p className="text-sm">{m.content}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-purple-200' : 'text-gray-500'}`}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={() => {
                sendMessage();
              }}
              disabled={!newMessage.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!itemToDelete} onOpenChange={(open) => { if (!open) setItemToDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => itemToDelete && deleteItem(itemToDelete)}
            disabled={deleting}
            className="bg-red-500 hover:bg-red-600"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
}
