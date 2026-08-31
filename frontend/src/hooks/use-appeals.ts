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
      const params: Record<string, string | undefined> = studentId ? { studentId } : {};
      const response = await api.get<{ data: Appeal[] } | Appeal[]>('/api/appeals/liturgy', { params });
      const data = Array.isArray(response.data) ? response.data : (response.data as any).data || [];
      setAppeals(data as Appeal[]);
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
        const response = await api.post<Appeal>('/api/appeals/liturgy', {
          studentId,
          familyLiturgyId,
          appealReason,
        });
        const newAppeal = response.data as Appeal;
        setAppeals((prev) => [newAppeal, ...prev]);
        return newAppeal;
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
      const response = await api.get<{ pending: number }>('/api/appeals/liturgy/pending/count');
      return (response.data as any).pending || 0;
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
