import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useProjects } from '../../hooks/useProject';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, UserIcon, CalendarIcon, ArchiveBoxIcon, MagnifyingGlassIcon, XMarkIcon, DocumentTextIcon, UserGroupIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

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
}

interface CreateProjectData {
  name: string;
  description: string;
  memberEmails: string[];
}

const ProjectsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createFormData, setCreateFormData] = useState<CreateProjectData>({
    name: '',
    description: '',
    memberEmails: []
  });
  const [memberEmailInput, setMemberEmailInput] = useState('');
  const [friends, setFriends] = useState<User[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<User[]>([]);
  const [showFriendsSuggestions, setShowFriendsSuggestions] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { projects, isLoading: loading, error, invalidateProjects } = useProjects({ enablePolling: true });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: CreateProjectData) => {
      const response = await api.post('/projects', projectData);
      return response.data;
    },
    onSuccess: () => {
      invalidateProjects();
      
      setLocalError(null);
      setCreateFormData({ name: '', description: '', memberEmails: [] });
      setMemberEmailInput('');
      setShowCreateForm(false);
      setShowFriendsSuggestions(false);
      
      if (createFormData.memberEmails.length > 0) {
        toast.success(`Project created! Invitations sent to ${createFormData.memberEmails.length} member(s).`);
      } else {
        toast.success('Project created successfully!');
      }
    },
    onError: (err: any) => {
      setLocalError(err.response?.data?.message || 'Failed to create project');
    }
  });

  useEffect(() => {
    fetchFriends();
  }, []);

  // Check if we should open the create modal based on navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openCreateModal) {
      setShowCreateForm(true);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Real-time project updates
  useEffect(() => {
    if (!socket || !currentUser) return;



    const handleProjectCreated = (data: any) => {

      // Only refresh if the user is a member of the new project
      if (data.project?.members?.some((member: any) => member.user._id === currentUser.id || member.user === currentUser.id)) {
        invalidateProjects();
        toast.success(`New project "${data.project.name}" was created!`);
      }
    };

    const handleProjectUpdated = (data: any) => {

      invalidateProjects();
      
      if (data.updateType === 'name') {
        toast.success(`Project name changed to "${data.project?.name}"`);
      }
    };

    const handleProjectDeleted = (data: any) => {

      invalidateProjects();
      toast.error(`Project "${data.projectName}" has been deleted`);
    };

    // Socket handlers for member updates removed - now using React Query polling
    // Project member counts will be updated through React Query refetch mechanisms

    // Listen for project-related events
    socket.on('project_created', handleProjectCreated);
    socket.on('project_updated', handleProjectUpdated);
    socket.on('project_deleted', handleProjectDeleted);
    // Member update listeners removed - now using React Query polling
    // Hybrid approach: Long polling + instant cache updates
    socket.on('member_added', () => {

      invalidateProjects();
    });
    socket.on('member_removed', () => {

      invalidateProjects();
    });

    return () => {

      socket.off('project_created', handleProjectCreated);
      socket.off('project_updated', handleProjectUpdated);
      socket.off('project_deleted', handleProjectDeleted);
      // Member update listeners removed - now using React Query polling
      // Cache invalidation listeners cleanup
      socket.off('member_added');
      socket.off('member_removed');
    };
  }, [socket, currentUser, invalidateProjects]);

  const fetchFriends = async () => {
    try {
      const response = await api.get('/users/friends');
      setFriends(response.data.friends);
    } catch (err: any) {
      console.error('Failed to fetch friends:', err);
    }
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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) return;

    createProjectMutation.mutate(createFormData);
  };

  const handleMemberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMemberEmailInput(value);
    
    if (value.length > 0) {
      const filtered = friends.filter(friend => 
        friend._id !== (currentUser as any)?._id && // Exclude current user
        (friend.fullName.toLowerCase().includes(value.toLowerCase()) ||
        friend.username.toLowerCase().includes(value.toLowerCase()) ||
        friend.email.toLowerCase().includes(value.toLowerCase()))
      );
      setFilteredFriends(filtered);
      setShowFriendsSuggestions(true);
    } else {
      setShowFriendsSuggestions(false);
    }
  };

  const addFriendToProject = (friend: User) => {
    if (!createFormData.memberEmails.includes(friend.email)) {
      setCreateFormData(prev => ({
        ...prev,
        memberEmails: [...prev.memberEmails, friend.email]
      }));
    }
    setMemberEmailInput('');
    setShowFriendsSuggestions(false);
  };

  const addMemberEmail = () => {
    const trimmedEmail = memberEmailInput.trim();
    
    if (!trimmedEmail) return;
    
    // Check if user is trying to add themselves
    if (trimmedEmail.toLowerCase() === (currentUser as any)?.email?.toLowerCase() || 
        trimmedEmail.toLowerCase() === (currentUser as any)?.username?.toLowerCase()) {
      setLocalError('You cannot add yourself to a project');
      return;
    }
    
    if (!createFormData.memberEmails.includes(trimmedEmail)) {
      setCreateFormData(prev => ({
        ...prev,
        memberEmails: [...prev.memberEmails, trimmedEmail]
      }));
      setMemberEmailInput('');
    }
  };

  const removeMemberEmail = (email: string) => {
    setCreateFormData(prev => ({
      ...prev,
      memberEmails: prev.memberEmails.filter(e => e !== email)
    }));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600">Manage your projects and teams</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading projects...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600">Manage your projects and teams</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/archived-projects')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              <ArchiveBoxIcon className="h-4 w-4 mr-2" />
              Archived Projects
            </button>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Project
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {(error || localError) && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">
              {localError || (error as any)?.message || 'An error occurred'}
            </p>
            <button 
              onClick={() => setLocalError(null)}
              className="text-red-600 hover:text-red-800 text-sm underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create Project Form */}
        {showCreateForm && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowFriendsSuggestions(false);
              }
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-teal-50 to-blue-50 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-teal-100 rounded-full">
                      <PlusIcon className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Create New Project</h3>
                      <p className="text-sm text-gray-600">Set up a new project and invite your team</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateFormData({ name: '', description: '', memberEmails: [] });
                      setMemberEmailInput('');
                      setShowFriendsSuggestions(false);
                    }}
                    className="text-gray-400 hover:text-gray-600 hover:bg-white rounded-full p-2 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Modal Content - Scrollable */}
              <div className="p-6 flex-1 overflow-y-auto">
                
                <form id="create-project-form" onSubmit={handleCreateProject} className="space-y-6">
                  {/* Project Name Field */}
                  <div className="space-y-2">
                    <label htmlFor="projectName" className="flex items-center text-sm font-semibold text-gray-800">
                      <span className="flex items-center justify-center w-5 h-5 bg-teal-100 rounded mr-2">
                        <span className="w-2 h-2 bg-teal-500 rounded"></span>
                      </span>
                      Project Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="projectName"
                        value={createFormData.name}
                        onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-sm placeholder-gray-400"
                        placeholder="Enter a descriptive project name"
                        maxLength={100}
                        required
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <div className={`w-2 h-2 rounded-full transition-colors ${
                          createFormData.name.trim() ? 'bg-green-400' : 'bg-gray-300'
                        }`}></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pl-7">
                      <p className="text-xs text-gray-500">Choose a clear and memorable name for your project</p>
                      <span className={`text-xs transition-colors ${
                        createFormData.name.length > 90 ? 'text-red-500 font-medium' : 
                        createFormData.name.length > 80 ? 'text-orange-500' : 'text-gray-400'
                      }`}>{createFormData.name.length}/100</span>
                    </div>
                  </div>

                  {/* Description Field */}
                  <div className="space-y-2">
                    <label htmlFor="projectDescription" className="flex items-center text-sm font-semibold text-gray-800">
                      <span className="flex items-center justify-center w-5 h-5 bg-blue-100 rounded mr-2">
                        <DocumentTextIcon className="w-3 h-3 text-blue-500" />
                      </span>
                      Description (Optional)
                    </label>
                    <textarea
                      id="projectDescription"
                      rows={3}
                      value={createFormData.description}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-sm placeholder-gray-400 resize-none"
                      placeholder="Briefly describe what this project is about..."
                    />
                    <div className="flex justify-between items-center pl-7">
                      <p className="text-xs text-gray-500">Help your team understand the project's purpose</p>
                      <span className="text-xs text-gray-400">{createFormData.description.length}/500</span>
                    </div>
                  </div>

                  {/* Team Members Section */}
                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-semibold text-gray-800">
                      <span className="flex items-center justify-center w-5 h-5 bg-purple-100 rounded mr-2">
                        <UserGroupIcon className="w-3 h-3 text-purple-500" />
                      </span>
                      Invite Team Members (Optional)
                    </label>
                    
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex space-x-2 mb-3">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={memberEmailInput}
                            onChange={handleMemberInputChange}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMemberEmail())}
                            className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-sm placeholder-gray-400 bg-white"
                            placeholder="Enter email, username, or search friends..."
                            onFocus={() => memberEmailInput.length > 0 && setShowFriendsSuggestions(true)}
                          />
                          
                          {/* Friends suggestions dropdown */}
                          {showFriendsSuggestions && filteredFriends.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-auto">
                              {filteredFriends.map((friend) => (
                                <div
                                  key={friend._id}
                                  onClick={() => addFriendToProject(friend)}
                                  className="px-4 py-3 hover:bg-teal-50 cursor-pointer flex items-center space-x-3 transition-colors border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-teal-400 to-blue-500 flex items-center justify-center shadow-sm">
                                    <span className="text-sm font-medium text-white">
                                      {friend.fullName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{friend.fullName}</p>
                                    <p className="text-xs text-gray-500">@{friend.username}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={addMemberEmail}
                          className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium shadow-sm"
                        >
                          Add
                        </button>
                      </div>
                      
                      {createFormData.memberEmails.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600 font-medium">Invited Members:</p>
                          <div className="grid gap-2">
                            {createFormData.memberEmails.map((email, index) => (
                              <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                    <span className="text-xs font-medium text-gray-600">
                                      {email.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="text-sm text-gray-700 font-medium">{email}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeMemberEmail(email)}
                                  className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                                  title="Remove member"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">You can add team members now or invite them later from project settings</p>
                      )}
                    </div>
                  </div>

                </form>
              </div>
              
              {/* Modal Footer - Fixed at bottom */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    <span className="inline-flex items-center">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
                      Project will be created instantly
                    </span>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setCreateFormData({ name: '', description: '', memberEmails: [] });
                        setMemberEmailInput('');
                        setShowFriendsSuggestions(false);
                      }}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="create-project-form"
                      disabled={createProjectMutation.isPending || !createFormData.name.trim()}
                      className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg hover:from-teal-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl text-sm font-semibold flex items-center space-x-2"
                    >
                      {createProjectMutation.isPending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-4 w-4" />
                          <span>Create Project</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="space-y-4">
          {(() => {
            const filteredProjects = projects.filter((project: Project) => 
              project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              project.creator.fullName.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filteredProjects.length === 0 && projects.length > 0 && searchQuery) {
              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">No Projects Found</h2>
                  <p className="text-gray-600">No projects match your search criteria. Try a different search term.</p>
                </div>
              );
            }
            
            if (projects.length === 0) {
              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">No Projects Yet</h2>
                  <p className="text-gray-600 mb-4">Create your first project to get started with team collaboration.</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create Your First Project
                  </button>
                </div>
              );
            }
            
            return filteredProjects.map((project: Project) => (
              <div key={project._id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex-1 cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded-lg transition-colors"
                      onClick={() => toggleProjectExpansion(project._id)}
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 break-words leading-tight max-w-xs min-w-0">{project.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 flex-shrink-0">
                          {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <UserIcon className="h-4 w-4 mr-1" />
                          Created by {project.creator.fullName}
                        </div>
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {new Date(project.createdAt).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 ml-4">
                      {/* Go to Project Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/project/${project._id}/board`);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-teal-300 text-sm font-medium rounded-md text-teal-700 bg-teal-50 hover:bg-teal-100 hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                      >
                        <ArrowRightIcon className="h-4 w-4 mr-1.5" />
                        Go to project
                      </button>
                      
                      {/* Expand/Collapse Icon */}
                      <button
                        onClick={() => toggleProjectExpansion(project._id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {expandedProjects.has(project._id) ? (
                          <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedProjects.has(project._id) && (
                  <div className="border-t border-gray-200 px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Project Details */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Project Details</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Created:</span>{' '}
                            <span className="text-gray-600">
                              {new Date(project.createdAt).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Last Updated:</span>{' '}
                            <span className="text-gray-600">
                              {new Date(project.updatedAt).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                          {project.description && (
                            <div>
                              <span className="font-medium text-gray-700">Description:</span>
                              <p className="text-gray-600 mt-1 break-words leading-relaxed max-w-sm">{project.description}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team Members */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Team Members</h4>
                        <div className="space-y-2">
                          {project.members.map((member: ProjectMember) => (
                            <div key={member._id} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                                    <span className="text-sm font-medium text-teal-800">
                                      {member.user.fullName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{member.user.fullName}</p>
                                  <p className="text-xs text-gray-500">@{member.user.username}</p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                                {member.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      </div>
    </Layout>
  );
};

export default ProjectsPage;
