import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Appeal {
  id: string;
  familyLiturgyId: string;
  appealReason: string;
  status: 'pending' | 'responded';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: { id: string; firstName: string; lastName: string };
  response?: string;
  newStatus?: string;
}

export function useAppeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppeals = useCallback(async (studentId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = studentId ? { studentId } : {};
      const response = await api.get('/api/appeals/liturgy', { params });
      setAppeals(response.data.data || response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch appeals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitAppeal = useCallback(
    async (studentId: string, familyLiturgyId: string, appealReason: string) => {
      setError(null);
      try {
        const response = await api.post('/api/appeals/liturgy', {
          studentId,
          familyLiturgyId,
          appealReason,
        });
        setAppeals((prev) => [response.data, ...prev]);
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit appeal';
        setError(message);
        throw err;
      }
    },
    []
  );

  const getPendingCount = useCallback(async () => {
    try {
      const response = await api.get('/api/appeals/liturgy/pending/count');
      return response.data.pending || 0;
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
      return 0;
    }
  }, []);

  return {
    appeals,
    isLoading,
    error,
    fetchAppeals,
    submitAppeal,
    getPendingCount,
  };
}
