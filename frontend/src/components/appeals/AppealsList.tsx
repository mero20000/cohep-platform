import React from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface Appeal {
  id: string;
  appealReason: string;
  status: 'pending' | 'responded';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: { firstName: string; lastName: string };
  response?: string;
  newStatus?: string;
}

interface AppealsListProps {
  appeals: Appeal[];
  isLoading?: boolean;
}

const statusColors = {
  approved: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
};

export function AppealsList({ appeals, isLoading = false }: AppealsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (appeals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No appeals yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appeals.map((appeal) => {
        const statusKey = (appeal.newStatus || appeal.status) as keyof typeof statusColors;
        const colors = statusColors[statusKey] || statusColors.pending;

        return (
          <div
            key={appeal.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {appeal.status === 'pending' ? (
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
                {new Date(appeal.createdAt).toLocaleDateString('en-GB')}
              </span>
            </div>

            {/* Appeal Reason */}
            <p className="text-sm text-gray-700 mb-3">{appeal.appealReason}</p>

            {/* Response (if available) */}
            {appeal.status === 'responded' && appeal.response && (
              <div className={`${colors.bg} border ${colors.border} rounded p-3`}>
                <p className="text-xs font-medium mb-1">Reviewer Response:</p>
                <p className="text-sm">{appeal.response}</p>
                {appeal.newStatus && (
                  <p className="text-sm font-semibold mt-2">
                    Status: {appeal.newStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
