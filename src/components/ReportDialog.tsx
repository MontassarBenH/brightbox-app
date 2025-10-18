'use client';

import { useState } from 'react';
import { Flag, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

type ReportDialogProps = {
  reportedUserId: string;
  reportedContentId: string;
  contentType: 'comment' | 'message' | 'video' | 'post';
  reporterUserId: string;
  trigger?: React.ReactNode;
};

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech or discrimination' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'other', label: 'Other' },
];

export function ReportDialog({
  reportedUserId,
  reportedContentId,
  contentType,
  reporterUserId,
  trigger,
}: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const supabase = createClient();

  const handleSubmit = async () => {
    if (!reason) return;

    setSubmitting(true);
    try {
      const reportData = {
        reporter_id: reporterUserId,
        reported_user_id: reportedUserId,
        content_type: contentType,
        content_id: reportedContentId,
        reason,
        description: description.trim() || null,
        status: 'pending',
      };

      const { error } = await supabase.from('reports').insert(reportData);
      if (error) throw error;

      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setReason('');
        setDescription('');
      }, 2000);
    } catch (error) {
      console.error('Report error:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        // Wrap the custom trigger so it can open the dialog
        <span
          onClick={() => setOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(true)}
          aria-label="Report"
          className="inline-flex"
        >
          {trigger}
        </span>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="text-gray-500 hover:text-red-500"
          aria-label="Report"
        >
          <Flag className="w-4 h-4" />
        </Button>
      )}

      <AlertDialogContent className="max-w-md">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Report Submitted</h3>
            <p className="text-sm text-gray-500">
              {"Thank you for helping keep our community safe. We'll review this report."}
            </p>
          </div>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                Report {contentType === 'comment' ? 'Comment' : 'Message'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {"Help us understand what's wrong with this "}{contentType}{"."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Why are you reporting this?
                </Label>
                <RadioGroup value={reason} onValueChange={setReason}>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((r) => (
                      <div key={r.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={r.value} id={r.value} />
                        <Label htmlFor={r.value} className="font-normal cursor-pointer">
                          {r.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium mb-2 block">
                  Additional details (optional)
                </Label>
                <Textarea
                  id="description"
                  placeholder={"Provide more context about why you're reporting this..."}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{description.length}/500 characters</p>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="bg-red-500 hover:bg-red-600"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
