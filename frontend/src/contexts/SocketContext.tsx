import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode} from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && token) {
      const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        auth: {
          token: token
        }
      });

      newSocket.on('connect', () => {

        setIsConnected(true);
        
        // Invalidate all queries when socket connects to ensure fresh data
        // This helps users who join later get current data
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
        
        // Only invalidate current project data if we're viewing a project
        const currentPath = window.location.pathname;
        const projectMatch = currentPath.match(/\/project\/([^\/]+)/);
        if (projectMatch) {
          const projectId = projectMatch[1];
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project', projectId, 'members'] });
          queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
          queryClient.invalidateQueries({ queryKey: ['bookmarked-notes', projectId] });
          queryClient.invalidateQueries({ queryKey: ['notes-activity', projectId] });
          queryClient.invalidateQueries({ queryKey: ['board-settings', projectId] });
        }
      });

      newSocket.on('disconnect', () => {

        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setIsConnected(false);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user, token]);

  // Global socket listeners for real-time updates
  useEffect(() => {
    if (!socket || !user || !isConnected) return;



    // Project Info Updates - Global listener
    const handleProjectInfoUpdate = (data: any) => {
      console.log('🏗️ Global: Project info updated', data);
      if (data.projectId) {
        // Invalidate specific project cache
        queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
        // Also invalidate projects list in case name changed
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    };

    const handleProjectDeleted = (data: any) => {
      const projectId = data.project || data.projectId;
      
      if (projectId) {
        // Always invalidate dashboard tasks when project is deleted
        queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
        
        // Remove from cache
        queryClient.removeQueries({ queryKey: ['project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['projects', user.id] });
        
        // Redirect ALL users viewing this project
        const isViewingProject = window.location.pathname.includes(`/project/${projectId}`) || 
                               window.location.pathname.includes(`project/${projectId}`);
        
        if (isViewingProject) {
          // Use window.location for immediate redirect with page refresh
          console.log('🔄 Using window.location.href for immediate redirect with page refresh');
          window.location.href = '/dashboard';
          
          // Show toast immediately after navigation
          const isDeleter = data.deletedBy?.id === user?.id;
          if (isDeleter) {
            toast.success(`Project "${data.projectName || 'Project'}" has been deleted successfully`);
          } else {
            toast.error(`Project "${data.projectName || 'Project'}" has been deleted and is no longer accessible`);
          }
        } else if (data.deletedBy?.id !== user.id) {
          // Show notification for users not currently viewing the project
          toast.error(`Project "${data.projectName || 'Project'}" has been deleted by ${data.deletedBy?.name || 'another user'}`);
        }
      }
    };

    // Team Member Updates - Global listener
    const handleMemberAdded = (data: any) => {

      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        // Also invalidate sidebar projects for the new member
        queryClient.invalidateQueries({ queryKey: ['projects', user.id] });
      }
    };

    const handleMemberRemoved = (data: any) => {

      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['projects', user.id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
        
        // If current user was removed, redirect them if they're viewing the project
        // Compare both string formats to handle ObjectId vs string differences
        const isRemovedUser = data.memberId === user?.id || data.memberId?.toString() === user?.id?.toString() || 
                             data.member?.id === user?.id || data.member?.id?.toString() === user?.id?.toString();

        
        if (isRemovedUser) {
          const isViewingProject = window.location.pathname.includes(`/project/${data.projectId}`) || 
                                 window.location.pathname.includes(`project/${data.projectId}`);
          
          if (isViewingProject) {
            window.location.href = '/dashboard';
            toast.error(`You have been removed from project "${data.project?.name || 'Project'}" and no longer have access`);
          } else {
            // Show notification for removed users not currently viewing the project
            toast.error(`You have been removed from project "${data.project?.name || 'Project'}" by ${data.removedBy?.name || 'an admin'}`);
          }
        } else if (data.removedBy?.id !== user?.id) {
          // Show notification to other members about the removal
          toast.success(`${data.member?.name || 'A member'} was removed from project "${data.project?.name || 'Project'}"`);
        }
      }
    };

    const handleRoleChanged = (data: any) => {

      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    };

    // Project Lifecycle Updates - Global listener
    const handleProjectUpdated = (data: any) => {
      const projectId = data.project?._id || data.project || data.projectId;
      

      
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        
        // Handle special update types
        if (data.updateType === 'archived') {
          // Always invalidate dashboard tasks when project is archived
          queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
          
          // Also refresh the project data to reflect archived status
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          
          // Redirect ALL users viewing this project (regardless of who archived it)
          const isViewingProject = window.location.pathname.includes(`/project/${projectId}`) || 
                                 window.location.pathname.includes(`project/${projectId}`);
          

          
          if (isViewingProject) {

            
            // Use window.location for immediate redirect to avoid race conditions

            window.location.href = '/dashboard';
            
            // Fallback with React Router navigation in case window.location fails
            try {
              navigate('/dashboard');
            } catch (error) {
              console.warn('React Router navigation failed, window.location already handled redirect');
            }
            
            // Show toast immediately after navigation
            const isArchiver = data.archivedBy?.id === user?.id;
            if (isArchiver) {
              toast.success(`Project "${data.project?.name || 'Project'}" has been archived successfully`);
            } else {
              toast.error(`Project "${data.project?.name || 'Project'}" has been archived and is no longer accessible`);
            }
          } else if (data.archivedBy?.id !== user.id) {
            // Show notification for users not currently viewing the project
            toast.error(`Project "${data.project?.name || 'Project'}" has been archived by ${data.archivedBy?.name || 'another user'}`);
          }
        } else if (data.updateType === 'unarchived') {
          // Always invalidate dashboard tasks when project is unarchived
          queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
          
          if (data.unarchivedBy?.id !== user.id) {
            toast.success(`Project "${data.project?.name || 'Project'}" has been unarchived by ${data.unarchivedBy?.name || 'another user'}`);
          }
        } else if (data.updateType === 'deleted') {
          // Always invalidate dashboard tasks when project is deleted
          queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
          
          // Remove from cache
          queryClient.removeQueries({ queryKey: ['project', projectId] });
          
          // Redirect ALL users viewing this project
          const isViewingProject = window.location.pathname.includes(`/project/${projectId}`) || 
                                 window.location.pathname.includes(`project/${projectId}`);
          
          if (isViewingProject) {
            navigate('/dashboard');
            // Show appropriate message based on who performed the action
            const isDeleter = data.deletedBy?.id === user?.id;
            if (isDeleter) {
              toast.success(`Project "${data.project?.name || 'Project'}" has been deleted successfully`);
            } else {
              toast.error(`Project "${data.project?.name || 'Project'}" has been deleted and is no longer accessible`);
            }
          } else if (data.deletedBy?.id !== user.id) {
            // Show notification for users not currently viewing the project
            toast.error(`Project "${data.project?.name || 'Project'}" has been deleted by ${data.deletedBy?.name || 'another user'}`);
          }
        } else if (data.updateType === 'info') {
          toast.success('Project settings were updated');
        }
      }
    };



    // Notification Updates - Global listener (for hybrid notifications)
    const handleNotificationReceived = (_notification: any) => {

      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    };

    // Friends Updates - Global listener
    const handleFriendsUpdated = () => {

      queryClient.invalidateQueries({ queryKey: ['friends', user.id] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests', user.id] });
    };

    // Task Updates - Global listener
    const handleTaskUpdate = () => {

      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    };

    // Project Creation - Global listener
    const handleProjectCreated = (_data: any) => {

      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', user.id] });
    };

    // Register all global listeners
    socket.on('project_info_updated', handleProjectInfoUpdate);
    socket.on('member_added', handleMemberAdded);
    socket.on('member_removed', handleMemberRemoved);
    socket.on('role_changed', handleRoleChanged);
    socket.on('project_updated', handleProjectUpdated);
    socket.on('project_deleted', handleProjectDeleted);

    socket.on('project_created', handleProjectCreated);
    socket.on('notification_received', handleNotificationReceived);
    socket.on('notifications_updated', handleNotificationReceived);
    socket.on('friends_updated', handleFriendsUpdated);
    socket.on('friend_requests_updated', handleFriendsUpdated);
    socket.on('friend_request_received', handleFriendsUpdated);
    socket.on('task-created', handleTaskUpdate);
    socket.on('task-updated', handleTaskUpdate);
    socket.on('task-deleted', handleTaskUpdate);
    socket.on('task-moved', handleTaskUpdate);
    socket.on('task-comment-added', handleTaskUpdate);

    // Cleanup function
    return () => {
      console.log('🌐 Cleaning up global socket listeners');
      socket.off('project_info_updated', handleProjectInfoUpdate);
      socket.off('member_added', handleMemberAdded);
      socket.off('member_removed', handleMemberRemoved);
      socket.off('role_changed', handleRoleChanged);
      socket.off('project_updated', handleProjectUpdated);
      socket.off('project_deleted', handleProjectDeleted);

      socket.off('project_created', handleProjectCreated);
      socket.off('notification_received', handleNotificationReceived);
      socket.off('notifications_updated', handleNotificationReceived);
      socket.off('friends_updated', handleFriendsUpdated);
      socket.off('friend_requests_updated', handleFriendsUpdated);
      socket.off('friend_request_received', handleFriendsUpdated);
      socket.off('task-created', handleTaskUpdate);
      socket.off('task-updated', handleTaskUpdate);
      socket.off('task-deleted', handleTaskUpdate);
      socket.off('task-moved', handleTaskUpdate);
      socket.off('task-comment-added', handleTaskUpdate);
    };
  }, [socket, user, isConnected, queryClient]);

  const value: SocketContextType = {
    socket,
    isConnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
