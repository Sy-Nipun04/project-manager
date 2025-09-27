import React, { useEffect } from 'react';
import Layout from '../../components/Layout';
import { DashboardTaskCard } from '../../components/dashboard/DashboardTaskCard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';
import { FolderOpen, Clock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';



const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data.projects;
    },
    enabled: !!user,
  });

  const { data: dashboardTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['dashboard-tasks', user?.id],
    queryFn: async () => {
      const response = await api.get('/tasks/dashboard');
      return response.data.tasks;
    },
    enabled: !!user,
  });

  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      const response = await api.get('/users/friends');
      return response.data.friends;
    },
    enabled: !!user,
  });

  const getCurrentTasks = () => {
    if (!dashboardTasks) return [];
    return dashboardTasks.map((task: any) => ({
      ...task,
      project: { _id: task.project, name: task.projectName }
    }));
  };

  const getStats = () => {
    const totalProjects = projects?.length || 0;
    const currentTasks = dashboardTasks?.length || 0;
    const totalFriends = friends?.length || 0;

    return { totalProjects, currentTasks, totalFriends };
  };

  const stats = getStats();
  const currentTasks = getCurrentTasks();

  // Real-time updates for dashboard
  useEffect(() => {
    if (!socket || !user) return;

    const handleTaskUpdate = () => {
      // Invalidate dashboard tasks to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks', user.id] });
    };

    // Listen for any task-related events
    socket.on('task-created', handleTaskUpdate);
    socket.on('task-updated', handleTaskUpdate);
    socket.on('task-deleted', handleTaskUpdate);
    socket.on('task-moved', handleTaskUpdate);

    return () => {
      socket.off('task-created', handleTaskUpdate);
      socket.off('task-updated', handleTaskUpdate);
      socket.off('task-deleted', handleTaskUpdate);
      socket.off('task-moved', handleTaskUpdate);
    };
  }, [socket, user, queryClient]);

  if (projectsLoading || tasksLoading || friendsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your projects.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-teal-100 rounded-lg">
                <FolderOpen className="h-6 w-6 text-teal-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Current Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{stats.currentTasks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Friends</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFriends}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Two Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Current Tasks */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Current Tasks</h2>
                <p className="text-sm text-gray-600">First doing task from your 5 most recently updated projects</p>
              </div>
              <div className="p-6">
                {currentTasks.length > 0 ? (
                  <div className="space-y-4">
                    {currentTasks.map((task: any) => (
                      <DashboardTaskCard
                        key={task._id}
                        task={task}
                        showProject={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No current tasks found</p>
                    <p className="text-xs text-gray-400 mt-1">Tasks in the "Doing" column will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Additional Content */}
          <div className="lg:col-span-1">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  to="/projects"
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  View All Projects
                </Link>
                <Link
                  to="/projects/create"
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Create New Project
                </Link>
              </div>
            </div>

            {/* Additional Panel - Reserved for future content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Panel</h2>
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Reserved for future content</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
