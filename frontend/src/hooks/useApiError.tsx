import { useState } from 'react';

interface ApiError {
  message: string;
  userFriendlyMessage?: string;
  status?: number;
}

interface UseApiErrorReturn {
  error: ApiError | null;
  clearError: () => void;
  handleApiError: (error: any) => void;
  isPermissionError: boolean;
  isAuthError: boolean;
}

export function useApiError(): UseApiErrorReturn {
  const [error, setError] = useState<ApiError | null>(null);

  const clearError = () => setError(null);

  const handleApiError = (apiError: any) => {
    const status = apiError.response?.status;
    const message = apiError.response?.data?.message || apiError.message || 'An error occurred';
    const userFriendlyMessage = apiError.response?.data?.userFriendlyMessage;

    setError({
      message,
      userFriendlyMessage,
      status
    });

    // Log the full error for debugging
    console.error('API Error:', apiError);
  };

  const isPermissionError = error?.status === 403;
  const isAuthError = error?.status === 401;

  return {
    error,
    clearError,
    handleApiError,
    isPermissionError,
    isAuthError
  };
}

// Error display component
interface ErrorMessageProps {
  error: ApiError | null;
  onClose?: () => void;
  className?: string;
}

export function ErrorMessage({ error, onClose, className = '' }: ErrorMessageProps) {
  if (!error) return null;

  const displayMessage = error.userFriendlyMessage || error.message;
  const isPermissionError = error.status === 403;
  const isAuthError = error.status === 401;

  const baseClasses = `p-4 rounded-lg border-l-4 ${className}`;
  const colorClasses = isPermissionError 
    ? 'bg-orange-50 border-orange-400 text-orange-800'
    : isAuthError
    ? 'bg-red-50 border-red-400 text-red-800'
    : 'bg-red-50 border-red-400 text-red-800';

  return (
    <div className={`${baseClasses} ${colorClasses}`}>
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isPermissionError ? 'Permission Denied' : isAuthError ? 'Authentication Required' : 'Error'}
          </p>
          <p className="text-sm mt-1">
            {displayMessage}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}