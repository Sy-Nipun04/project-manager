import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useProject } from '../../hooks/useProject';
import { getRoleDisplayInfo } from '../../lib/permissions';
import { InformationCircleIcon, UserIcon, PencilIcon, DocumentTextIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useSocket } from '../../contexts/SocketContext';
import ReactMarkdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import toast from 'react-hot-toast';

const ProjectInfoPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  
  // State for markdown editing
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // State for project editing
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [showNameChangeConfirm, setShowNameChangeConfirm] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);



  const { project, isLoading, invalidateProject } = useProject(projectId, { enablePolling: true });

  // Get permissions using fresh project data
  const { can, isMember, userRole } = usePermissions(project);

  // Mutation to save markdown details
  const updateProjectDetailsMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log('Saving markdown content:', content);
      console.log('Project ID:', projectId);
      const response = await api.put(`/projects/${projectId}/markdown`, { content });
      console.log('Save response:', response.data);
      return response.data.project;
    },
    onSuccess: (updatedProject) => {

      queryClient.setQueryData(['project', projectId], updatedProject);
      invalidateProject();
      toast.success('Project details updated successfully');
      setIsEditingDetails(false);
      setIsSaving(false);
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast.error('Failed to update project details');
      setIsSaving(false);
    }
  });

  // Mutation to update project basic information
  const updateProjectInfoMutation = useMutation({
    mutationFn: async ({ name, description, nameChanged }: { name: string; description: string; nameChanged: boolean }) => {
      console.log('Updating project info:', { name, description, nameChanged });
      const response = await api.put(`/projects/${projectId}/settings`, { 
        name, 
        description,
        notifyNameChange: nameChanged 
      });
      console.log('Update response:', response.data);
      return response.data.project;
    },
    onSuccess: (updatedProject) => {

      queryClient.setQueryData(['project', projectId], updatedProject);
      invalidateProject();
      
      const nameChanged = projectName !== project?.name;
      if (nameChanged) {
        toast.success('Project name updated! All members have been notified.');
      } else {
        toast.success('Project information updated successfully');
      }
      
      setIsEditingProject(false);
      setIsSavingProject(false);
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Failed to update project information');
      setIsSavingProject(false);
    }
  });

  // Auto-select the project in sidebar when viewing it
  useEffect(() => {
    if (project && (!selectedProject || selectedProject._id !== project._id)) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

  // Sync project data with state
  useEffect(() => {
    if (project) {
      const content = project.markdownContent || '';
      setMarkdownContent(content);
      setProjectName(project.name);
      setProjectDescription(project.description || '');
      console.log('Project loaded:', {
        projectId: project._id,
        projectName: project.name,
        markdownContent: content
      });
    }
  }, [project]);

  // Real-time project info updates
  useEffect(() => {
    if (!socket || !projectId) return;



    // Project info update handler removed - now using React Query polling

    const handleProjectDeleted = (data: any) => {

      if (data.project === projectId || data.projectId === projectId) {
        queryClient.removeQueries({ queryKey: ['project', projectId] });
        toast.error('This project has been deleted');
        window.location.href = '/projects';
      }
    };

    // Join project room for real-time updates
    socket.emit('join_project', projectId);

    // Listen for access control events only
    // Hybrid approach: Long polling + instant cache updates for info changes
    socket.on('project_updated', (data) => {
      // Handle archive events
      if (data.updateType === 'archived') {

        window.location.href = '/dashboard';
        return;
      }
      
      if (data.type !== 'archive' && data.type !== 'delete') {

        invalidateProject();
      }
    });
    socket.on('project_deleted', handleProjectDeleted);

    return () => {

      socket.off('project_updated'); // Info updates removed
      socket.off('project_deleted', handleProjectDeleted);
      socket.emit('leave_project', projectId);
    };
  }, [socket, projectId, invalidateProject]);

  // Handlers for markdown editing
  const handleEditDetails = () => {
    const currentContent = project?.markdownContent || '';
    setMarkdownContent(currentContent);
    setIsEditingDetails(true);

  };

  const handleSaveDetails = () => {
    const currentProjectContent = project?.markdownContent || '';
    if (markdownContent !== currentProjectContent) {
      setIsSaving(true);
      console.log('Saving changes:', { 
        old: currentProjectContent, 
        new: markdownContent 
      });
      updateProjectDetailsMutation.mutate(markdownContent);
    } else {
      setIsEditingDetails(false);

    }
  };

  const handleCancelEdit = () => {
    const currentContent = project?.markdownContent || '';
    setMarkdownContent(currentContent);
    setIsEditingDetails(false);

  };

  // Handlers for project information editing
  const handleEditProject = () => {
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || '');
      setIsEditingProject(true);
    }
  };

  const handleSaveProject = () => {
    const originalName = project?.name || '';
    const nameChanged = projectName !== originalName;
    
    if (nameChanged) {
      setShowNameChangeConfirm(true);
    } else {
      // No name change, just update directly
      setIsSavingProject(true);
      updateProjectInfoMutation.mutate({
        name: projectName,
        description: projectDescription,
        nameChanged: false
      });
    }
  };

  const handleConfirmNameChange = () => {
    setShowNameChangeConfirm(false);
    setIsSavingProject(true);
    updateProjectInfoMutation.mutate({
      name: projectName,
      description: projectDescription,
      nameChanged: true
    });
  };

  const handleCancelProjectEdit = () => {
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || '');
    }
    setIsEditingProject(false);
    setShowNameChangeConfirm(false);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
          <p className="text-gray-600">The requested project could not be found.</p>
        </div>
      </Layout>
    );
  }

  // Check if user has access to view the project
  if (!isMember) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have access to this project. Contact an admin to be added as a member.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 min-w-0 flex-1">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl shadow-sm">
              <InformationCircleIcon className="h-7 w-7 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Project Information</h1>
              <p className="text-gray-600">
                Essential details and documentation
                {userRole && (
                  <span className="ml-2 text-sm">
                    (You have {getRoleDisplayInfo(userRole).label} access)
                  </span>
                )}
              </p>
            </div>
          </div>
          
          {/* Action buttons - Only for editors and admins */}
          <div className="flex space-x-2">
            {can.editProjectInfo() && (
              <button 
                onClick={handleEditProject}
                className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit Project Information
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Header with enhanced gradient */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-5 border-b border-gray-150">
                <h2 className="text-xl font-bold text-gray-900">
                  Basic Information
                </h2>
              </div>
              
              <div className="p-6 bg-gradient-to-br from-white to-gray-50/30">
                <div className="grid grid-cols-1 gap-6">
                  {/* Project Name */}
                  <div className="relative group">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        Project Name
                      </label>
                      <div className="h-px bg-gradient-to-r from-blue-200 to-transparent flex-1 ml-4"></div>
                    </div>
                    <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 group-hover:shadow-md transition-all duration-200">
                      <div className="p-4">
                        <h3 className="text-gray-700 leading-relaxed break-words text-base">{project.name}</h3>
                        <p className="text-xs text-blue-600/70 mt-1 font-medium">{project.name.length}/100 characters</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="relative group">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        Description
                      </label>
                      <div className="h-px bg-gradient-to-r from-green-200 to-transparent flex-1 ml-4"></div>
                    </div>
                    <div className="relative overflow-hidden rounded-xl border border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 group-hover:shadow-md transition-all duration-200">
                      <div className="p-4">
                        {project.description ? (
                          <>
                            <p className="text-gray-700 leading-relaxed break-words text-base">{project.description}</p>
                            <p className="text-xs text-green-600/70 mt-2 font-medium">{project.description.length}/500 characters</p>
                          </>
                        ) : (
                          <div className="flex items-center space-x-2 text-gray-500">
                            <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-xs font-bold text-white">?</span>
                            </div>
                            <span className="italic text-sm">No description provided.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Created By */}
                  <div className="relative group">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                        Created By
                      </label>
                      <div className="h-px bg-gradient-to-r from-purple-200 to-transparent flex-1 ml-4"></div>
                    </div>
                    <div className="relative overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-pink-50 group-hover:shadow-md transition-all duration-200">
                      <div className="p-4">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                              <span className="text-white font-bold text-lg">
                                {project.creator?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-lg break-words">{project.creator?.fullName || 'Unknown User'}</p>
                            <p className="text-sm text-purple-600 font-medium">@{project.creator?.username || 'unknown'}</p>
                            <p className="text-xs text-gray-500 mt-1">Project Creator & Administrator</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dates Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Created</label>
                        <div className="h-px bg-gray-200 flex-1 ml-4"></div>
                      </div>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                          <p className="font-medium text-gray-900">
                            {new Date(project.createdAt).toLocaleDateString('en-GB', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-4">
                          {new Date(project.createdAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Last Updated</label>
                        <div className="h-px bg-gray-200 flex-1 ml-4"></div>
                      </div>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                          <p className="font-medium text-gray-900">
                            {new Date(project.updatedAt).toLocaleDateString('en-GB', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-4">
                          {new Date(project.updatedAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Creator */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">Project Creator</h2>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-100">
                <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    {project.creator?.fullName?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {project.creator?.fullName || 'Unknown Creator'}
                  </h3>
                  <p className="text-gray-600 text-sm">@{project.creator?.username || 'unknown'}</p>
                  {project.creator?.email && (
                    <p className="text-gray-500 text-sm mt-1">{project.creator.email}</p>
                  )}
                  <div className="flex items-center mt-2">
                    <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
                      Project Owner
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Details with Markdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">Project Readme</h2>
                </div>
                {can.editProjectInfo() && (
                  <div className="flex items-center space-x-2">
                    {!isEditingDetails ? (
                      <button
                        onClick={handleEditDetails}
                        className="flex items-center px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleSaveDetails}
                          disabled={isSaving}
                          className="flex items-center px-3 py-1.5 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckIcon className="h-4 w-4 mr-1" />
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="flex items-center px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4 mr-1" />
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="prose prose-sm max-w-none">
                {!isEditingDetails ? (
                  <div className="min-h-[200px] p-4 border border-gray-200 rounded-lg bg-white">
                    {project.markdownContent ? (
                      <ReactMarkdown 
                        className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-teal-600 prose-strong:text-gray-900 prose-code:text-teal-600 prose-pre:bg-gray-100"
                        components={{
                          h1: ({children}) => <h1 className="text-2xl font-bold text-gray-900 mb-4">{children}</h1>,
                          h2: ({children}) => <h2 className="text-xl font-semibold text-gray-900 mb-3">{children}</h2>,
                          h3: ({children}) => <h3 className="text-lg font-semibold text-gray-900 mb-2">{children}</h3>,
                          p: ({children}) => <p className="text-gray-700 mb-3 leading-relaxed">{children}</p>,
                          ul: ({children}) => <ul className="list-disc list-inside text-gray-700 mb-3 space-y-1">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal list-inside text-gray-700 mb-3 space-y-1">{children}</ol>,
                          li: ({children}) => <li className="text-gray-700">{children}</li>,
                          code: ({children}) => <code className="bg-gray-100 text-teal-600 px-1 py-0.5 rounded text-sm">{children}</code>,
                          pre: ({children}) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                          blockquote: ({children}) => <blockquote className="border-l-4 border-teal-500 pl-4 italic text-gray-600 mb-3">{children}</blockquote>,
                          a: ({href, children}) => <a href={href} className="text-teal-600 hover:text-teal-700 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                        }}
                      >
                        {project.markdownContent}
                      </ReactMarkdown>
                    ) : (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        <div className="text-center">
                          <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p>No detailed description provided.</p>
                          {can.editProjectInfo() && (
                            <p className="text-sm mt-1">Click Edit to add project details.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div data-color-mode="light">
                    <MDEditor
                      value={markdownContent}
                      onChange={(val) => setMarkdownContent(val || '')}
                      preview="edit"
                      height={400}
                      visibleDragbar={false}
                      data-color-mode="light"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Project Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Team Size</span>
                  <span className="font-medium text-gray-900">{project.members?.length || 0} members</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created</span>
                  <span className="font-medium text-gray-900">
                    {new Date(project.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last Updated</span>
                  <span className="font-medium text-gray-900">
                    {new Date(project.updatedAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Edit Project Modal */}
      {isEditingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Project Information</h3>
                <button
                  onClick={handleCancelProjectEdit}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project name"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {projectName.length}/100 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Enter project description"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {projectDescription.length}/500 characters
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCancelProjectEdit}
                  disabled={isSavingProject}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProject}
                  disabled={isSavingProject || !projectName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingProject ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Name Change Confirmation Modal */}
      {showNameChangeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">
                      Confirm Name Change
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowNameChangeConfirm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  You are about to change the project name from:
                </p>
                <div className="my-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 break-words leading-tight">"{project?.name}"</p>
                </div>
                <p className="text-sm text-gray-600 mb-2">to:</p>
                <div className="mb-3 p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 break-words leading-tight">"{projectName}"</p>
                </div>
                <p className="text-sm text-gray-600">
                  All project members will be notified of this change. Are you sure you want to continue?
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowNameChangeConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmNameChange}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
                >
                  Yes, Change Name
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProjectInfoPage;