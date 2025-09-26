import React, { useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjects, useSidebarProjects } from '../../hooks/useProject';
import toast from 'react-hot-toast';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  UserIcon, 
  CalendarIcon, 
  ArchiveBoxIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

interface User {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  profileImage?: string;
}

interface ProjectMember {
  _id: string;
  user: User;
  role: 'viewer' | 'editor' | 'admin';
  joinedAt: string;
}

interface Project {
  _id: string;
  name: string;
  description?: string;
  creator: User;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
  settings: {
    isArchived: boolean;
    archivedAt?: string;
    archivedBy?: User;
  };
}

const ArchivedProjectsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { invalidateProjects } = useProjects();
  const { invalidateSidebarProjects } = useSidebarProjects(currentUser?.id);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const { 
    data: archivedProjects = [], 
    isLoading: loading, 
    error
  } = useQuery({
    queryKey: ['projects', 'archived'],
    queryFn: async () => {
      const response = await api.get('/projects/archived');
      
      // Backend already filters projects where user is creator or member
      // Only show projects where user can archive/unarchive (admin or creator)
      const manageableProjects = response.data.projects.filter((project: Project) => {
        const isCreator = project.creator._id === currentUser?.id;
        const isAdminMember = project.members.find((member: ProjectMember) => 
          member.user._id === currentUser?.id && member.role === 'admin'
        );
        return isCreator || !!isAdminMember;
      });
      return manageableProjects;
    },
    enabled: !!currentUser
  });

  const unarchiveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await api.post(`/projects/${projectId}/unarchive`, {
        notifyMembers: true,
        action: 'unarchived'
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all relevant queries using hooks
      invalidateProjects();
      invalidateSidebarProjects();
      queryClient.invalidateQueries({ queryKey: ['projects', 'archived'] });
      
      toast.success('Project unarchived successfully. All members have been notified.');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to unarchive project';
      toast.error(errorMessage);
    }
  });

  const handleUnarchiveProject = (projectId: string) => {
    unarchiveProjectMutation.mutate(projectId);
  };

  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-600 bg-red-50';
      case 'editor': return 'text-blue-600 bg-blue-50';
      case 'viewer': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <button
                onClick={() => navigate('/projects')}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                title="Back to Projects"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Archived Projects</h1>
            </div>
            <p className="text-gray-600 ml-11">
              Manage archived projects where you have admin access or are the creator
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search archived projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{(error as any)?.message || 'An error occurred'}</p>
          </div>
        )}

        {/* Archived Projects List */}
        <div className="space-y-4">
          {(() => {
            const filteredProjects = archivedProjects.filter((project: Project) => 
              project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              project.creator.fullName.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filteredProjects.length === 0 && archivedProjects.length > 0 && searchQuery) {
              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">No Archived Projects Found</h2>
                  <p className="text-gray-600">No archived projects match your search criteria. Try a different search term.</p>
                </div>
              );
            }
            
            if (archivedProjects.length === 0) {
              return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <ArchiveBoxIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No Archived Projects</h2>
              <p className="text-gray-600 mb-4">
                You don't have any archived projects where you have management access.
              </p>
              <button
                onClick={() => navigate('/projects')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Projects
              </button>
              </div>
              );
            }
            
            return filteredProjects.map((project: Project) => (
              <div key={project._id} className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-90">
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleProjectExpansion(project._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <ArchiveBoxIcon className="h-3 w-3 mr-1" />
                          Archived
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                          {project.members.length} {project.members.length === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-gray-600 mt-1">{project.description}</p>
                      )}
                      <div className="text-sm text-gray-500 mt-2 space-y-1">
                        <p>Created by {project.creator.fullName} • {formatDate(project.createdAt)}</p>
                        {project.settings.archivedAt && (
                          <p>
                            Archived on {formatDate(project.settings.archivedAt)}
                            {project.settings.archivedBy && ` by ${project.settings.archivedBy.fullName}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnarchiveProject(project._id);
                        }}
                        disabled={unarchiveProjectMutation.isPending}
                        className="px-3 py-1 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50"
                      >
                        {unarchiveProjectMutation.isPending ? 'Unarchiving...' : 'Unarchive'}
                      </button>
                      {expandedProjects.has(project._id) ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedProjects.has(project._id) && (
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Project Members</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {project.members.map((member: ProjectMember, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                      {member.user?.fullName?.charAt(0) || 'U'}
                                    </span>
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {member.user?.fullName || 'Unknown User'}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    @{member.user?.username || 'unknown'}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                                {member.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <CalendarIcon className="h-4 w-4" />
                          <span>Created: {formatDate(project.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <UserIcon className="h-4 w-4" />
                          <span>By: {project.creator.fullName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>

        {/* Info Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">📋 About Archived Projects</h4>
          <p className="text-sm text-blue-700">
            Only projects where you have admin access or are the creator are shown here. Archived projects are hidden from 
            the main projects list and search. You can unarchive projects to restore them to active status.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default ArchivedProjectsPage;