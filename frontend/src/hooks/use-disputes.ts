import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Dispute {
  id: string;
  submissionId: string;
  reason: string;
  status: 'pending' | 'responded';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: { id: string; firstName: string; lastName: string };
  response?: string;
  newScore?: number;
}

export function useDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDisputes = useCallback(async (submissionId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = submissionId ? { submissionId } : {};
      const response = await api.get('/api/disputes', { params });
      setDisputes(response.data.data || response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch disputes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitDispute = useCallback(
    async (submissionId: string, reason: string) => {
      setError(null);
      try {
        const response = await api.post('/api/disputes', {
          submissionId,
          reason,
        });
        setDisputes((prev) => [response.data, ...prev]);
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit dispute';
        setError(message);
        throw err;
      }
    },
    []
  );

  const getPendingCount = useCallback(async () => {
    try {
      const response = await api.get('/api/disputes/pending/count');
      return response.data.pending || 0;
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
      return 0;
    }
  }, []);

  return {
    disputes,
    isLoading,
    error,
    fetchDisputes,
    submitDispute,
    getPendingCount,
  };
}
