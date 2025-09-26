import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { useProjects, useSidebarProjects } from '../../hooks/useProject';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BellIcon, 
  UserPlusIcon, 
  FolderOpenIcon, 
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Notification {
  _id: string;
  type: 'friend_accepted' | 'project_invitation' | 'invitation_accepted' | 'invitation_declined' | 'member_added' | 'role_changed' | 'member_removed' | 'task_assigned' | 'note_created';
  title: string;
  message: string;
  data?: {
    project?: string | { _id: string; name: string };
    user?: string;
    invitation?: string;
    actionTaken?: 'accepted' | 'declined';
    isInvalid?: boolean;
  };
  isRead: boolean;
  createdAt: string;
}

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { invalidateProjects } = useProjects();
  const { invalidateSidebarProjects } = useSidebarProjects(user?.id);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLast7Days, setShowLast7Days] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    unreadCount: 0,
    last7DaysCount: 0
  });

  useEffect(() => {
    fetchNotifications();
  }, [showLast7Days]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: showLast7Days ? '0' : '10',
        last7Days: showLast7Days.toString()
      });
      
      const response = await api.get(`/notifications?${params}`);
      const fetchedNotifications = response.data.notifications;
      
      // Mark all unread notifications as read when the page loads
      const unreadNotifications = fetchedNotifications.filter((n: Notification) => !n.isRead);
      if (unreadNotifications.length > 0) {
        try {
          // Mark all notifications as read
          await api.put('/notifications/mark-all-read');
          
          // Update the local state to reflect the read status
          const updatedNotifications = fetchedNotifications.map((n: Notification) => ({
            ...n,
            isRead: true
          }));
          setNotifications(updatedNotifications);
        } catch (markReadError) {
          console.error('Failed to mark notifications as read:', markReadError);
          // Still show notifications even if marking as read fails
          setNotifications(fetchedNotifications);
        }
      } else {
        setNotifications(fetchedNotifications);
      }
      
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };







  const handleProjectInvitation = async (notificationId: string, action: 'accept' | 'decline') => {
    try {
      const notification = notifications.find(n => n._id === notificationId);
      
      console.log('Full notification object:', JSON.stringify(notification, null, 2));
      
      if (!notification) {
        setError('Notification not found');
        return;
      }
      
      if (!notification.data) {
        setError('Invalid notification - missing data object');
        return;
      }
      
      if (!notification.data.project) {
        setError('Invalid notification data - missing project information');
        return;
      }

      // Extract project ID - handle both string and object cases
      const projectId = typeof notification.data.project === 'string' 
        ? notification.data.project 
        : notification.data.project?._id;
        
      const invitationId = notification.data.invitation;
      
      console.log('Extracted data:', { projectId, invitationId, action, dataObject: notification.data });
      
      if (!projectId) {
        setError('Invalid notification data - could not extract project ID');
        return;
      }
      
      if (!invitationId || invitationId === projectId) {
        setError(`Invalid notification data - missing or incorrect invitation ID (got: ${invitationId})`);
        return;
      }

      console.log('Handling project invitation:', { projectId, invitationId, action });

      const response = await api.put(`/projects/${projectId}/invitation/${invitationId}`, { action });
      console.log('Project invitation response:', response.data);
      
      // If the invitation was accepted, invalidate projects cache to update sidebar
      if (action === 'accept') {
        invalidateProjects();
        invalidateSidebarProjects();
      }
      
      // Update the notification to show it's been processed
      setNotifications(prev => prev.map(n => 
        n._id === notificationId 
          ? { 
              ...n, 
              isRead: true,
              data: { ...n.data, actionTaken: action === 'accept' ? 'accepted' : 'declined' },
              message: `You ${action === 'accept' ? 'accepted' : 'declined'} the invitation to join the project`
            }
          : n
      ));
      
    } catch (err: any) {
      console.error('Project invitation error:', err);
      
      // Check if the error is due to invalid invitation
      if (err.response?.data?.message?.includes('no longer valid') || err.response?.data?.message?.includes('invalid')) {
        // Mark this notification as invalid locally
        setNotifications(prev => prev.map(n => 
          n._id === notificationId 
            ? { 
                ...n, 
                data: { 
                  ...n.data, 
                  isInvalid: true 
                }
              }
            : n
        ));
        setError('This invitation is no longer valid.');
      } else {
        const errorMessage = err.response?.data?.message || err.message || `Failed to ${action} project invitation`;
        setError(errorMessage);
      }
    }
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
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm underline mt-1"
            >
              Dismiss
            </button>
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
              {notifications.map((notification) => (
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
