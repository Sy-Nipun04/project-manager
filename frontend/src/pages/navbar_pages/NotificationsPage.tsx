import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { useProjects, useSidebarProjects } from '../../hooks/useProject';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  BellIcon, 
  UserPlusIcon, 
  FolderOpenIcon, 
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';



const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { invalidateProjects } = useProjects();
  const { invalidateSidebarProjects } = useSidebarProjects(user?.id);
  
  const [showLast7Days, setShowLast7Days] = useState(false);

  // React Query for notifications with 10-minute polling
  const {
    data: notificationsData,
    isLoading: loading,
    error
  } = useQuery({
    queryKey: ['notifications', user?.id, showLast7Days],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: showLast7Days ? '0' : '10',
        last7Days: showLast7Days.toString()
      });
      
      const response = await api.get(`/notifications?${params}`);
      return response.data;
    },
    enabled: !!user?.id,
    refetchInterval: 10 * 60 * 1000, // 10 minutes (efficient fallback since we have socket updates)
    staleTime: 30 * 1000, // 30 seconds (use global setting)
    refetchOnMount: 'always', // Always fetch fresh data when page loads
    refetchOnWindowFocus: true, // Refetch when user comes back to tab
    refetchIntervalInBackground: true
  });

  const notifications = notificationsData?.notifications || [];
  const pagination = {
    total: notificationsData?.pagination?.total || 0,
    unreadCount: notificationsData?.pagination?.unreadCount || 0,
    last7DaysCount: notificationsData?.pagination?.last7DaysCount || 0
  };

  // Note: Socket listeners for notifications are now handled globally in SocketContext
  // This ensures real-time updates work regardless of which page the user is on

  // Mark all notifications as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.put('/notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });

  // Auto-mark all as read when page loads with unread notifications
  useEffect(() => {
    if (notifications.length > 0 && pagination.unreadCount > 0) {
      markAllReadMutation.mutate();
    }
  }, [notifications.length, pagination.unreadCount]);

  // Project invitation response mutation
  const invitationMutation = useMutation({
    mutationFn: async ({ projectId, invitationId, action }: {
      projectId: string;
      invitationId: string;
      action: 'accept' | 'decline';
    }) => {
      const response = await api.put(`/projects/${projectId}/invitation/${invitationId}`, { action });
      return { response: response.data, action };
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      if (data.action === 'accept') {
        invalidateProjects();
        invalidateSidebarProjects();
      }
    },
    onError: (error: any) => {
      console.error('Error handling project invitation:', error);
    }
  });

  const handleProjectInvitation = async (notificationId: string, action: 'accept' | 'decline') => {
    const notification = notifications.find((n: any) => n._id === notificationId);
    
    if (!notification?.data?.project || !notification?.data?.invitation) {
      console.error('Invalid notification data');
      return;
    }

    const projectId = typeof notification.data.project === 'string' 
      ? notification.data.project 
      : notification.data.project?._id;
      
    const invitationId = notification.data.invitation;

    if (!projectId || !invitationId) {
      console.error('Missing project ID or invitation ID');
      return;
    }

    invitationMutation.mutate({ projectId, invitationId, action });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_accepted':
        return <UserPlusIcon className="h-6 w-6 text-blue-600" />;
      case 'project_invitation':
      case 'member_added':
        return <FolderOpenIcon className="h-6 w-6 text-teal-600" />;
      case 'invitation_accepted':
        return <CheckIcon className="h-6 w-6 text-green-600" />;
      case 'invitation_declined':
        return <XMarkIcon className="h-6 w-6 text-red-600" />;
      case 'role_changed':
        return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />;
      case 'high_priority_task_created':
      case 'high_priority_task_updated':
        return <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />;
      case 'task_assigned':
        return <BellIcon className="h-6 w-6 text-blue-600" />;
      default:
        return <BellIcon className="h-6 w-6 text-gray-600" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-GB');
    }
  };



  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600">Stay updated with project activities and invitations</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading notifications...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Stay updated with project activities and invitations</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">Failed to load notifications. Please refresh the page.</p>
          </div>
        )}

        {/* View Controls and Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowLast7Days(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  !showLast7Days 
                    ? 'bg-teal-100 text-teal-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Recent (10)
              </button>
              <button
                onClick={() => setShowLast7Days(true)}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  showLast7Days 
                    ? 'bg-teal-100 text-teal-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Last 7 Days ({pagination.last7DaysCount})
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              {showLast7Days ? `${notifications.length} total` : `Showing ${Math.min(10, notifications.length)} of ${pagination.total}`}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Notifications</h3>
              <p className="text-gray-600">You're all caught up! New notifications will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification: any) => (
                <div
                  key={notification._id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium text-gray-900">
                                {notification.type === 'project_invitation' ? notification.title : notification.title}
                              </h3>
                              {!notification.isRead && (
                                <span className="inline-block h-2 w-2 bg-blue-600 rounded-full"></span>
                              )}
                            </div>
                            <span className="text-sm text-gray-500">
                              {getTimeAgo(notification.createdAt)}
                            </span>
                          </div>                      <p className="mt-1 text-sm text-gray-600">
                        {notification.message}
                      </p>



                      {/* Special handling for project invitations */}
                      {notification.type === 'project_invitation' && !notification.data?.actionTaken && !notification.data?.isInvalid && notification.data?.project && (
                        <div className="mt-3 flex space-x-2">
                          <button
                            onClick={() => handleProjectInvitation(notification._id, 'accept')}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none"
                          >
                            <CheckIcon className="h-3 w-3 mr-1" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleProjectInvitation(notification._id, 'decline')}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                          >
                            <XMarkIcon className="h-3 w-3 mr-1" />
                            Decline
                          </button>
                        </div>
                      )}

                      {/* Show invalid invitation status */}
                      {notification.type === 'project_invitation' && (notification.data?.isInvalid || !notification.data?.project) && !notification.data?.actionTaken && (
                        <div className="mt-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Project Invitation Invalid
                          </span>
                        </div>
                      )}

                      {/* Show status for processed project invitations */}
                      {notification.type === 'project_invitation' && notification.data?.actionTaken && (
                        <div className="mt-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            notification.data.actionTaken === 'accepted' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {notification.data.actionTaken === 'accepted' ? (
                              <>
                                <CheckIcon className="h-3 w-3 mr-1" />
                                Accepted
                              </>
                            ) : (
                              <>
                                <XMarkIcon className="h-3 w-3 mr-1" />
                                Declined
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                ))}
            </div>
          )}
        </div>



        {/* Cleanup Information */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">
                Notifications older than 7 days are automatically deleted.
                {showLast7Days && (
                  <span className="font-medium"> Currently showing all notifications from the last 7 days.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotificationsPage;
