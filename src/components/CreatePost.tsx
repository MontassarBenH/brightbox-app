'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=70&auto=format',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=70&auto=format',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=70&auto=format',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=70&auto=format',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=70&auto=format',
];

export function CreatePost({
  userId,
  subjects,
  onPostCreated,
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

  const charLimit = 500;
  const charsUsed = content.length;
  const charsLeft = charLimit - charsUsed;
  const canPost = content.trim().length > 0 && !creating;

  const handleCreate = async () => {
    if (!content.trim()) return;

    setCreating(true);
    try {
      const { error } = await supabase.from('posts').insert({
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
        <Button className="rounded-full" size="icon" aria-label="Create post">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="subject" aria-label="Select a subject">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      <span className="truncate">
                        {subject.icon} {subject.name}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share something with your school..."
              rows={4}
              maxLength={charLimit}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {charsUsed}/{charLimit}
              </span>
              {charsLeft < 50 && (
                <span className={charsLeft < 0 ? 'text-red-500' : 'text-gray-500'}>
                  {charsLeft} left
                </span>
              )}
            </div>
          </div>

          {/* Background selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Background Image (optional)
            </Label>

            {/* Selected preview (large) */}
            <div className="relative w-full h-40 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              {selectedBg ? (
                <Image
                  src={selectedBg}
                  alt="Selected background"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 640px"
                  priority={false}
                />
              ) : (
                <div className="grid h-full place-items-center text-sm text-gray-500">
                  No background selected
                </div>
              )}
            </div>

            {/* Thumbnails */}
             <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {/* None option */}
              <button
                onClick={() => setSelectedBg('')}
                aria-pressed={!selectedBg}
                className={`relative aspect-square rounded-lg border-2 flex items-center justify-center transition
                  ${!selectedBg ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <X className="w-6 h-6 text-gray-400" />
                <span className="sr-only">No background</span>
              </button>

              {backgroundImages.map((bg, i) => {
                const active = selectedBg === bg;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedBg(bg)}
                    aria-pressed={active}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition
                      ${active ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Image
                      src={bg}
                      alt={`Background ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 33vw, 120px"
                    />
                    <span className="sr-only">Select background {i + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <Button onClick={handleCreate} disabled={!canPost} className="w-full">
            {creating ? 'Creating…' : 'Post'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
