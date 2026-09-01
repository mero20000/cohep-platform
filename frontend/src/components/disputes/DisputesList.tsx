import React from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface Dispute {
  id: string;
  reason: string;
  status: 'pending' | 'responded';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: { firstName: string; lastName: string };
  response?: string;
  newScore?: number;
}

interface DisputesListProps {
  disputes: Dispute[];
  isLoading?: boolean;
  maxScore: number;
}

export function DisputesList({ disputes, isLoading = false, maxScore }: DisputesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (disputes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No disputes yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map((dispute) => (
        <div
          key={dispute.id}
          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {dispute.status === 'pending' ? (
                <>
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700">Pending Review</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Responded</span>
                </>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {new Date(dispute.createdAt).toLocaleDateString('en-GB')}
            </span>
          </div>

          {/* Reason */}
          <p className="text-sm text-gray-700 mb-3">{dispute.reason}</p>

          {/* Response (if available) */}
          {dispute.status === 'responded' && dispute.response && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
              <p className="text-xs font-medium text-blue-900 mb-1">Instructor Response:</p>
              <p className="text-sm text-blue-900">{dispute.response}</p>
              {dispute.newScore !== undefined && (
                <p className="text-sm font-semibold text-blue-600 mt-2">
                  New Score: {dispute.newScore} / {maxScore}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
