'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Upload, Video, User as UserIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

export default function FeedClient({ user }: { user: User }) {
  const supabase = createClient();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async () => {
  // First get messages
  const { data: messagesData, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(50);

  if (messagesError) {
    console.error('Error loading messages:', messagesError);
    return;
  }

  if (!messagesData) {
    return;
  }

  const userIds = [...new Set(messagesData.map(m => m.user_id))];
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (profilesError) {
    console.error('Error loading profiles:', profilesError);
  }

  const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
  const combinedData = messagesData.map(msg => ({
    ...msg,
    profiles: profilesMap.get(msg.user_id) || null
  }));

  console.log('Messages loaded:', combinedData);
  setMessages(combinedData as Message[]);
}, [supabase]);

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel('messages-feed')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages' 
        },
        (payload) => {
          console.log('New message received:', payload);
          loadMessages(); 
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [supabase, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content) return;

    console.log('Sending message:', content);

    const { data, error } = await supabase.from('messages').insert({
      user_id: user.id,
      content,
    }).select();

    console.log('Send message result:', { data, error });

    if (!error) {
      setNewMessage('');
      loadMessages();
    } else {
      console.error('Failed to send message:', error);
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 w-10 h-10 rounded-lg flex items-center justify-center">
            <Video className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">BrightBox</h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {user.email}
            </p>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 flex flex-col p-6">
          <div className="flex-1 flex flex-col">
            {/* Video Feed Placeholder */}
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span>Recent Videos</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full max-w-3xl aspect-video flex items-center justify-center mb-6">
                  <div className="text-center">
                    <div className="bg-gray-300 border-2 border-dashed rounded-xl w-16 h-16 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No video feed available</p>
                    <Button>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Video
                    </Button>
                  </div>
                </div>
                <p className="text-gray-500 text-sm">Your recent videos will appear here</p>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Chat Sidebar */}
        <aside className="w-full md:w-96 border-l border-gray-200 bg-white flex flex-col">
          <Card className="flex-1 flex flex-col h-full rounded-none border-0">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="flex items-center">
                <MessageCircle className="mr-2 h-5 w-5" />
                Chat ({messages.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm mt-8">
                    No messages yet. Say hi! 👋
                  </div>
                ) : (
                  messages.map((m) => {
                    const isOwn = m.user_id === user.id;
                    const senderName =
                      m.profiles?.username ||
                      m.profiles?.email ||
                      'User';
                    const initial = senderName[0]?.toUpperCase();

                    return (
                      <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            isOwn
                              ? 'bg-purple-600 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-800 rounded-bl-none'
                          }`}
                        >
                          {!isOwn && (
                            <div className="flex items-center mb-1">
                              <Avatar className="w-6 h-6 mr-2">
                                {m.profiles?.avatar_url ? (
                                  <AvatarImage src={m.profiles.avatar_url} alt={senderName} />
                                ) : (
                                  <AvatarFallback className="text-xs">
                                    {initial}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <p className="text-xs font-semibold text-gray-500">
                                {senderName}
                              </p>
                            </div>
                          )}
                          <p>{m.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              isOwn ? 'text-purple-200' : 'text-gray-500'
                            }`}
                          >
                            {formatTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 p-4">
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
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}