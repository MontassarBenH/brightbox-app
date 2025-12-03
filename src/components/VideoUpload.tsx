'use client';

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { getUserRole, canPost as canUserPost } from '@/lib/roles';

type Subject = { id: string; name: string; color: string; icon: string };

type VideoUploadProps = {
  userId: string;
  subjects: Subject[];
  onUploadSuccess: () => void;
};

export function VideoUpload({ userId, subjects, onUploadSuccess }: VideoUploadProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }
    // ~100 MB max 
    if (f.size > 100 * 1024 * 1024) {
      alert('File size must be less than 100MB');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);

    try {
      // Defense-in-depth: Check role again
      const role = await getUserRole(supabase, userId);
      if (!canUserPost(role)) {
        throw new Error('Unauthorized: You do not have permission to upload videos.');
      }

      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'mp4';
      const fileName = `${userId}/${Date.now()}.${ext}`;
      setProgress(30);

      // Upload to Supabase Storage with a long cache TTL
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, {
          cacheControl: '31536000', // seconds
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(70);

      // Public URL
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName);

      // Save DB record
      const { error: dbError } = await supabase.from('videos').insert({
        user_id: userId,
        title: title || file.name,
        mux_playback_id: urlData.publicUrl,
        mux_asset_id: fileName,
        status: 'ready',
        subject_id: subjectId || null,
      });

      if (dbError) {
        throw dbError;
      }

      setProgress(100);

      // Reset
      setOpen(false);
      setFile(null);
      setTitle('');
      setSubjectId('');
      onUploadSuccess();
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unknown error';
      alert(`Upload failed: ${message}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" aria-label="Upload video" title="Upload video">
          <Upload className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Video</DialogTitle>
          <DialogDescription>Upload a video (max 100MB)</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your video a title"
              disabled={uploading}
            />
          </div>

          <div>
            <Label>Subject (optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={uploading}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="video">Video File</Label>
            <Input
              id="video"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="cursor-pointer"
            />
            {file && (
              <div className="mt-2 flex items-center justify-between bg-gray-100 p-2 rounded">
                <span className="text-sm text-gray-700 truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {uploading && (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Uploading... {progress}%
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
