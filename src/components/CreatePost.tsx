'use client';

import { useState } from 'react';
import { Plus, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

type Subject = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

const backgroundImages = [
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=800',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
];

export function CreatePost({ 
  userId, 
  subjects,
  onPostCreated 
}: { 
  userId: string;
  subjects: Subject[];
  onPostCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [selectedBg, setSelectedBg] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  const handleCreate = async () => {
    if (!content.trim()) return;

    setCreating(true);
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          content: content.trim(),
          background_image: selectedBg || null,
          subject_id: subjectId || null,
        });

      if (error) throw error;

      setContent('');
      setSelectedBg('');
      setSubjectId('');
      setOpen(false);
      onPostCreated();
    } catch (error) {
      console.error('Create post error:', error);
      alert('Failed to create post');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full" size="icon">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Subject (Optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.icon} {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share something with your school..."
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">{content.length}/500</p>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Background Image (Optional)
            </Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                onClick={() => setSelectedBg('')}
                className={`aspect-square rounded-lg border-2 flex items-center justify-center ${
                  !selectedBg ? 'border-purple-500' : 'border-gray-200'
                }`}
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
              {backgroundImages.map((bg, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedBg(bg)}
                  className={`aspect-square rounded-lg border-2 overflow-hidden ${
                    selectedBg === bg ? 'border-purple-500' : 'border-gray-200'
                  }`}
                >
                  <img src={bg} alt={`Background ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!content.trim() || creating}
            className="w-full"
          >
            {creating ? 'Creating...' : 'Post'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}