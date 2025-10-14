'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, X, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import Link from 'next/link';

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    username?: string | null;
    email?: string | null;
  } | null;
};

interface CommentsProps {
  itemId: string;
  itemType: 'video' | 'post';
  userId: string;
  commentsCount: number;
  onCountChange: (newCount: number) => void;
}

export function Comments({ itemId, itemType, userId, commentsCount, onCountChange }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const supabase = createClient();
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadComments = useCallback(async () => {
    const column = itemType === 'video' ? 'video_id' : 'post_id';
    const { data: commentsData, error } = await supabase
      .from('comments')
      .select('*')
      .eq(column, itemId)
      .order('created_at', { ascending: true });

    if (error || !commentsData) return;

    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', userIds);

    const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));
    const combined = commentsData.map(comment => ({
      ...comment,
      profiles: profilesMap.get(comment.user_id) || null,
    }));

    setComments(combined);
    onCountChange(combined.length);
  }, [supabase, itemId, itemType, onCountChange]);

  useEffect(() => {
    if (open) {
      loadComments();

      const channel = supabase
        .channel(`comments-${itemType}-${itemId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `${itemType}_id=eq.${itemId}`,
          },
          () => loadComments()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, supabase, loadComments, itemId, itemType]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [comments, open]);

  const addComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('comments').insert({
        user_id: userId,
        [itemType === 'video' ? 'video_id' : 'post_id']: itemId,
        content: newComment.trim(),
      });

      if (error) throw error;

      // Update count in parent table
      await supabase
        .from(itemType === 'video' ? 'videos' : 'posts')
        .update({ comments_count: commentsCount + 1 })
        .eq('id', itemId);

      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Add comment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Update count
      await supabase
        .from(itemType === 'video' ? 'videos' : 'posts')
        .update({ comments_count: Math.max(0, commentsCount - 1) })
        .eq('id', itemId);

      loadComments();
    } catch (error) {
      console.error('Delete comment error:', error);
    }
  };

  const formatTime = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex flex-col items-center">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs mt-1 font-semibold">{commentsCount}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments ({comments.length})
          </SheetTitle>
        </SheetHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-8">
              No comments yet. Be the first! 💬
            </div>
          ) : (
            comments.map((comment) => {
              const isOwn = comment.user_id === userId;
              const username = comment.profiles?.username || comment.profiles?.email || 'User';
              const initial = username[0]?.toUpperCase();

              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Link
                          href={`/profile/${comment.user_id}`}
                          className="font-semibold text-sm hover:underline"
                        >
                          {username}
                        </Link>
                        {isOwn && (
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-800">{comment.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-1">
                      {formatTime(comment.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Add Comment Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addComment();
                }
              }}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={addComment} disabled={!newComment.trim() || loading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}