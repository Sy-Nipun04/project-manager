import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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
        console.log('🟢 Socket connected to server:', newSocket.id);
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
        console.log('Disconnected from server');
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

    console.log('🌐 Setting up global socket listeners for real-time updates');

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

    // Team Member Updates - Global listener
    const handleMemberAdded = (data: any) => {
      console.log('👥 Global: Member added', data);
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        // Also invalidate sidebar projects for the new member
        queryClient.invalidateQueries({ queryKey: ['projects', user.id] });
      }
    };

    const handleMemberRemoved = (data: any) => {
      console.log('👥 Global: Member removed', data);
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['projects', user.id] });
        
        // If current user was removed, redirect them
        if (data.memberId && data.removedBy !== user.id) {
          // Check if we need to redirect (we'll get this info from the project query failure)
        }
      }
    };

    const handleRoleChanged = (data: any) => {
      console.log('🔐 Global: Role changed', data);
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    };

    // Project Lifecycle Updates - Global listener
    const handleProjectUpdated = (data: any) => {
      console.log('📋 Global: Project updated', data);
      const projectId = data.project?._id || data.project || data.projectId;
      
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        
        // Handle special update types
        if (data.updateType === 'archived' && data.archivedBy?.id !== user.id) {
          toast.error(`Project "${data.project?.name || 'Project'}" has been archived by ${data.archivedBy?.name || 'another user'}`);
          // Redirect if user is currently viewing this project
          if (window.location.pathname.includes(projectId)) {
            navigate('/projects');
          }
        } else if (data.updateType === 'deleted') {
          toast.error(`Project "${data.project?.name || 'Project'}" has been deleted`);
          // Remove from cache and redirect
          queryClient.removeQueries({ queryKey: ['project', projectId] });
          if (window.location.pathname.includes(projectId)) {
            navigate('/projects');
          }
        } else if (data.updateType === 'info') {
          toast.success('Project settings were updated');
        }
      }
    };

    const handleProjectDeleted = (data: any) => {
      console.log('🗑️ Global: Project deleted', data);
      const projectId = data.project || data.projectId;
      
      if (projectId) {
        queryClient.removeQueries({ queryKey: ['project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['projects', user.id] });
        
        toast.error('Project has been deleted');
        
        // Redirect if user is currently viewing this project
        if (window.location.pathname.includes(projectId)) {
          navigate('/projects');
        }
      }
    };

    // Notification Updates - Global listener (for hybrid notifications)
    const handleNotificationReceived = (notification: any) => {
      console.log('🔔 Global: Notification received', notification);
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    };

    // Friends Updates - Global listener
    const handleFriendsUpdated = () => {
      console.log('👥 Global: Friends updated');
      queryClient.invalidateQueries({ queryKey: ['friends', user.id] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests', user.id] });
    };

    // Task Updates - Global listener
    const handleTaskUpdate = () => {
      console.log('📋 Global: Task updated');
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    };

    // Project Creation - Global listener
    const handleProjectCreated = (data: any) => {
      console.log('🆕 Global: Project created', data);
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
