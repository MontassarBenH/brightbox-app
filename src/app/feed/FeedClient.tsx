'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Video as VideoIcon, User as UserIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import dynamic from 'next/dynamic';

const VideoUpload = dynamic(
  () => import('@/components/VideoUpload').then(m => m.VideoUpload),
  { ssr: false }
);


type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
};

type Video = {
  id: string;
  user_id: string;
  title: string;
  mux_playback_id: string;
  created_at: string;
  profiles: {
    username?: string | null;
    email?: string | null;
  } | null;
};

export default function FeedClient({ user }: { user: User }) {
  const supabase = createClient();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async () => {
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (messagesError) {
      console.error('Error loading messages:', messagesError);
      return;
    }

    if (!messagesData) return;

    const userIds = [...new Set(messagesData.map(m => m.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    const combinedData = messagesData.map(msg => ({
      ...msg,
      profiles: profilesMap.get(msg.user_id) || null,
    }));

    setMessages(combinedData as Message[]);
  }, [supabase]);

  const loadVideos = useCallback(async () => {
    const { data: videosData, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(20);

    if (videosError) {
      console.error('Error loading videos:', videosError);
      return;
    }

    if (!videosData) return;

    const userIds = [...new Set(videosData.map(v => v.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    const combinedData = videosData.map(video => ({
      ...video,
      profiles: profilesMap.get(video.user_id) || null,
    }));

    setVideos(combinedData as Video[]);
  }, [supabase]);

  useEffect(() => {
    loadMessages();
    loadVideos();

    const messagesChannel = supabase
      .channel('messages-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadMessages()
      )
      .subscribe();

    const videosChannel = supabase
      .channel('videos-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'videos' },
        () => loadVideos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(videosChannel);
    };
  }, [supabase, loadMessages, loadVideos]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content) return;

    const { error } = await supabase
      .from('messages')
      .insert({ user_id: user.id, content })
      .select();

    if (!error) {
      setNewMessage('');
      loadMessages();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const userInitial = (user.email || 'U')[0]?.toUpperCase();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 w-10 h-10 rounded-lg flex items-center justify-center">
            <VideoIcon className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">BrightBox</h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
            <p className="text-xs text-gray-500">Online</p>
          </div>
          <Avatar>
            <AvatarImage src="" alt={user.email ?? 'user'} />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Feed - Reels Style */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-white flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold">Videos</h2>
            <VideoUpload userId={user.id} onUploadSuccess={loadVideos} />
          </div>

          {/* Scrollable Reels Container */}
          <div 
            ref={videoContainerRef}
            className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            
            {videos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8">
                <VideoIcon className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">No videos yet</p>
                <p className="text-sm text-gray-400 mb-4">Upload your first video to get started</p>
                <VideoUpload userId={user.id} onUploadSuccess={loadVideos} />
              </div>
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  className="h-screen snap-start flex items-center justify-center bg-black relative"
                >
                  {/* Video */}
                  <video
                    src={video.mux_playback_id}
                    controls
                    className="max-h-full max-w-full"
                    playsInline
                  />

                  {/* Video Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg mb-1">
                          {video.title}
                        </h3>
                        <div className="flex items-center text-white/80 text-sm">
                          <Avatar className="w-6 h-6 mr-2">
                            <AvatarFallback className="text-xs">
                              {(video.profiles?.username || video.profiles?.email || 'U')[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{video.profiles?.username || video.profiles?.email || 'Unknown'}</span>
                          <span className="mx-2">•</span>
                          <span>{formatTime(video.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* Chat Sidebar - Fixed Height */}
        <aside className="w-96 border-l border-gray-200 bg-white flex flex-col h-full">
          {/* Chat Header */}
          <div className="border-b border-gray-200 p-4 flex-shrink-0">
            <div className="flex items-center">
              <MessageCircle className="mr-2 h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Chat ({messages.length})</h3>
            </div>
          </div>

          {/* Messages - Scrollable */}
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
                      className={`max-w-xs px-4 py-2 rounded-lg ${
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

          {/* Message Input - Fixed at Bottom */}
          <div className="border-t border-gray-200 p-4 flex-shrink-0">
            <div className="flex space-x-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}