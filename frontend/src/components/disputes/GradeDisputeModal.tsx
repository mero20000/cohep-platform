import React, { useState } from 'react';
import { AlertCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GradeDisputeModalProps {
  isOpen: boolean;
  submissionId: string;
  submissionTitle: string;
  currentScore: number;
  maxScore: number;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export function GradeDisputeModal({
  isOpen,
  submissionId,
  submissionTitle,
  currentScore,
  maxScore,
  onClose,
  onSubmit,
}: GradeDisputeModalProps) {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('Please provide a reason for your dispute');
      return;
    }

    if (reason.length < 10) {
      setError('Please provide at least 10 characters');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(reason);
      toast({
        title: 'Dispute submitted',
        description: 'Your grade re-grade request has been sent to the instructor.',
        variant: 'default',
      });
      setReason('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit dispute');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Request Grade Re-evaluation</h2>
          <p className="text-sm text-gray-600 mt-1">{submissionTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Score Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Current Score</p>
            <p className="text-2xl font-bold text-blue-600">
              {currentScore} / {maxScore}
            </p>
          </div>

          {/* Reason Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for dispute *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you believe this grade should be re-evaluated..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Dispute
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
