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
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          const id = el.getAttribute('data-feed-id');
          if (!id) return;

          const v = videoRefs.current.get(id);
          if (!v) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // play visible video
            v.play().catch(() => {});
          } else {
            // pause when out of view
            v.pause();
          }
        });
      },
      { root: container, threshold: [0.0, 0.6, 1.0] }
    );

    const sections = container.querySelectorAll('[data-feed-id]');
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [videos, posts]);

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

    const userIds = [...new Set(videosData.map(v => v.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    setVideos(videosData.map(video => ({
      ...video,
      profiles: profilesMap.get(video.user_id) || null,
    })));
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

    const userIds = [...new Set(postsData.map(p => p.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    setPosts(postsData.map(post => ({
      ...post,
      profiles: profilesMap.get(post.user_id) || null,
    })));
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
  const toggleLike = async (item: FeedItem) => {
    const key = `${item.type}-${item.id}`;
    const isLiked = likedItems.has(key);

    if (isLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq(item.type === 'video' ? 'video_id' : 'post_id', item.id);

      await supabase
        .from(item.type === 'video' ? 'videos' : 'posts')
        .update({ likes_count: Math.max(0, item.likes_count - 1) })
        .eq('id', item.id);

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

      await supabase
        .from(item.type === 'video' ? 'videos' : 'posts')
        .update({ likes_count: item.likes_count + 1 })
        .eq('id', item.id);

      setLikedItems(prev => new Set(prev).add(key));
    }

    if (item.type === 'video') loadVideos();
    else loadPosts();
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

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(postsChannel);
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
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 px-4 py-3">
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
        {/* Feed */}
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
                        <div className="relative w-full h-full flex items-center justify-center">
                          {/* Video */}
                          <video
                            ref={(el) => {
                              if (el) videoRefs.current.set(`${item.type}-${item.id}`, el);
                              else videoRefs.current.delete(`${item.type}-${item.id}`);
                            }}
                            src={v.mux_playback_id}
                            className="max-h-full max-w-full"
                            playsInline
                            muted
                            loop
                            // no native controls; we show our own overlay
                            controls={false}
                            onClick={() => toggleVideoPlay(`${item.type}-${item.id}`)}
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

                  {/* Info Overlay (bottom) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pl-20 md:pl-24">
                    <div className="max-w-4xl">
                      {item.type === 'video' && (
                        <h3 className="text-white font-semibold text-lg mb-2">
                          {(item as VideoItem).title}
                        </h3>
                      )}
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="w-10 h-10 border-2 border-white">
                          <AvatarFallback className="text-xs">
                            {(item.profiles?.username || item.profiles?.email || 'U')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white font-semibold">
                            {item.profiles?.username || item.profiles?.email || 'Anonymous'}
                          </p>
                          <p className="text-white/70 text-sm">{formatTime(item.created_at)}</p>
                        </div>
                      </div>
                      {item.subject_id && (
                        <Badge
                          style={{
                            backgroundColor: subjects.find(s => s.id === item.subject_id)?.color,
                          }}
                          className="text-white"
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
