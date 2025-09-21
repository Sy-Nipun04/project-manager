import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, UserIcon, CalendarIcon } from '@heroicons/react/24/outline';

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateProjectData>({
    name: '',
    description: '',
    memberEmails: []
  });
  const [memberEmailInput, setMemberEmailInput] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/projects');
      setProjects(response.data.projects);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) return;

    try {
      setCreateLoading(true);
      await api.post('/projects', createFormData);
      
      // Reset form and refresh projects
      setCreateFormData({ name: '', description: '', memberEmails: [] });
      setMemberEmailInput('');
      setShowCreateForm(false);
      await fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreateLoading(false);
    }
  };

  const addMemberEmail = () => {
    if (memberEmailInput.trim() && !createFormData.memberEmails.includes(memberEmailInput.trim())) {
      setCreateFormData(prev => ({
        ...prev,
        memberEmails: [...prev.memberEmails, memberEmailInput.trim()]
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
          
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Project
          </button>
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

        {/* Create Project Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Project</h3>
                
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div>
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      id="projectName"
                      value={createFormData.name}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                      placeholder="Enter project name"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700">
                      Description (Optional)
                    </label>
                    <textarea
                      id="projectDescription"
                      rows={3}
                      value={createFormData.description}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                      placeholder="Project description..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invite Team Members (Optional)
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="email"
                        value={memberEmailInput}
                        onChange={(e) => setMemberEmailInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMemberEmail())}
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                        placeholder="Enter email or username"
                      />
                      <button
                        type="button"
                        onClick={addMemberEmail}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-gray-50 hover:bg-gray-100"
                      >
                        Add
                      </button>
                    </div>
                    
                    {createFormData.memberEmails.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {createFormData.memberEmails.map((email, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                            <span className="text-sm text-gray-700">{email}</span>
                            <button
                              type="button"
                              onClick={() => removeMemberEmail(email)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setCreateFormData({ name: '', description: '', memberEmails: [] });
                        setMemberEmailInput('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading || !createFormData.name.trim()}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createLoading ? 'Creating...' : 'Create Project'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="space-y-4">
          {projects.length === 0 ? (
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
          ) : (
            projects.map((project) => (
              <div key={project._id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleProjectExpansion(project._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                          {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {project.description && (
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">{project.description}</p>
                      )}
                      
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <UserIcon className="h-4 w-4 mr-1" />
                          Created by {project.creator.fullName}
                        </div>
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {new Date(project.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {expandedProjects.has(project._id) ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      )}
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
                              {new Date(project.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Last Updated:</span>{' '}
                            <span className="text-gray-600">
                              {new Date(project.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {project.description && (
                            <div>
                              <span className="font-medium text-gray-700">Description:</span>
                              <p className="text-gray-600 mt-1">{project.description}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team Members */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Team Members</h4>
                        <div className="space-y-2">
                          {project.members.map((member) => (
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
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ProjectsPage;
