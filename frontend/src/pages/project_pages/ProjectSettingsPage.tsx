import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDisplayInfo } from '../../lib/permissions';
import { 
  CogIcon,
  UserIcon,
  PlusIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LockClosedIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const { isMember, userRole } = usePermissions();
  const { user } = useAuth(); // Using for authentication context
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  
  // State for modals and forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [deleteConfirmation, setDeleteConfirmation] = useState({ projectName: '', password: '' });
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}`);
      return response.data.project;
    },
    enabled: !!projectId
  });

  // Mutations
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const response = await api.post(`/projects/${projectId}/invite`, { email, role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('viewer');
      toast.success('Invitation sent successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send invitation');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await api.delete(`/projects/${projectId}/members/${memberId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Member removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    }
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await api.put(`/projects/${projectId}/members/${memberId}/role`, { role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Member role updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update member role');
    }
  });

  const archiveProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/projects/${projectId}/archive`, {
        notifyMembers: true,
        action: 'archived'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', (user as any)?.id] });
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      
      toast.success('Project archived successfully. All members have been notified.');
      navigate('/projects');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to archive project');
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async ({ projectName, password }: { projectName: string; password: string }) => {
      const response = await api.delete(`/projects/${projectId}`, {
        data: { 
          projectName, 
          password,
          notifyMembers: true,
          action: 'deleted'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', (user as any)?.id] });
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      
      toast.success('Project deleted successfully. All members have been notified.');
      navigate('/projects');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete project');
    }
  });

  // Auto-select the project in sidebar when viewing it
  useEffect(() => {
    if (project && (!selectedProject || selectedProject._id !== project._id)) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

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

  // Check if user has admin access
  // Check if user can manage settings (using can.editProjectInfo internally in components)

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'members', name: 'Team & Permissions', icon: UserIcon },
    { id: 'advanced', name: 'Advanced', icon: ExclamationTriangleIcon }
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12">
          <CogIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">General Settings</h3>
          <p className="text-gray-600">
            General project settings will be available here soon.
          </p>
        </div>
      </div>
    </div>
  );

  const renderMembersSettings = () => {
    const isAdmin = userRole === 'admin';
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
            {isAdmin && (
              <button 
                onClick={() => setShowInviteModal(true)}
                disabled={!isAdmin}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isAdmin 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <PlusIcon className="h-4 w-4 mr-2 inline" />
                Invite Members
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {project.members?.map((member: any) => {
              const roleInfo = getRoleDisplayInfo(member.role);
              const isExpanded = expandedMembers.has(member._id);
              const isCreator = member.user?._id === project.creator._id;
              
              return (
                <div key={member._id} className={`border rounded-lg ${isAdmin ? '' : 'opacity-75'}`}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {member.user?.fullName?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">
                            {member.user?.fullName || 'Unknown User'}
                          </p>
                          {isCreator && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              Creator
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">@{member.user?.username || 'unknown'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleInfo.color} ${roleInfo.bgColor}`}>
                        {roleInfo.label}
                      </span>
                      
                      {isAdmin && !isCreator && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedMembers);
                            if (isExpanded) {
                              newExpanded.delete(member._id);
                            } else {
                              newExpanded.add(member._id);
                            }
                            setExpandedMembers(newExpanded);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && isAdmin && !isCreator && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <div className="pt-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Change Role
                          </label>
                          <select
                            value={member.role}
                            onChange={(e) => {
                              updateMemberRoleMutation.mutate({
                                memberId: member._id,
                                role: e.target.value
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={updateMemberRoleMutation.isPending}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove ${member.user?.fullName} from the project?`)) {
                                removeMemberMutation.mutate(member._id);
                              }
                            }}
                            disabled={removeMemberMutation.isPending}
                            className="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                          >
                            <TrashIcon className="h-4 w-4 mr-1 inline" />
                            Remove Member
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {!isAdmin && (
            <p className="text-sm text-gray-500 mt-4">
              You need admin permissions to manage team members.
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          {[
            { name: 'Task Updates', description: 'Get notified when tasks are created, updated, or completed' },
            { name: 'Project Changes', description: 'Notifications about project settings and information changes' },
            { name: 'Team Activity', description: 'Updates about new members joining or leaving the project' },
            { name: 'Deadline Reminders', description: 'Reminders about upcoming task deadlines' },
          ].map((setting) => (
            <div key={setting.name} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{setting.name}</p>
                <p className="text-sm text-gray-500">{setting.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Visibility</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
            <LockClosedIcon className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">Private Project</p>
              <p className="text-sm text-gray-500">Only invited members can access this project</p>
            </div>
            <input type="radio" name="visibility" defaultChecked className="ml-auto" />
          </div>
          <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg opacity-50">
            <GlobeAltIcon className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">Public Project</p>
              <p className="text-sm text-gray-500">Anyone in your organization can view this project</p>
            </div>
            <input type="radio" name="visibility" disabled className="ml-auto" />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          🚀 Public projects coming soon! Currently all projects are private by default.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Require approval for new members</p>
              <p className="text-sm text-gray-500">New member requests need admin approval</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => {
    const isAdmin = userRole === 'admin';
    
    return (
      <div className="space-y-6">
        {isAdmin ? (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Archive Project</h3>
              <div className="flex items-start space-x-3">
                <ArchiveBoxIcon className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-gray-900 mb-2">
                    Archive this project to make it read-only. Archived projects can be restored later.
                  </p>
                  <button 
                    onClick={() => setShowArchiveModal(true)}
                    disabled={archiveProjectMutation.isPending}
                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    {archiveProjectMutation.isPending ? 'Archiving...' : 'Archive Project'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-900 mb-2">
                      <strong>Delete this project</strong>
                    </p>
                    <p className="text-red-700 mb-4">
                      Once you delete a project, there is no going back. Please be certain.
                    </p>
                    <button 
                      onClick={() => setShowDeleteModal(true)}
                      disabled={deleteProjectMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-8">
              <KeyIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Admin Access Required</h3>
              <p className="text-gray-600">
                You need admin permissions to access advanced project settings.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'members':
        return renderMembersSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'privacy':
        return renderPrivacySettings();
      case 'advanced':
        return renderAdvancedSettings();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gray-100 rounded-lg">
            <CogIcon className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Settings</h1>
            <p className="text-gray-600">
              Manage settings and preferences for {project.name}
              {userRole && (
                <span className="ml-2 text-sm">
                  (You have {getRoleDisplayInfo(userRole).label} access)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Settings Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
          <h4 className="font-medium text-blue-900 mb-2">🚀 More Settings Coming Soon</h4>
          <p className="text-sm text-blue-700">
            We're working on additional features including integrations, automation rules, 
            custom fields, and more advanced project management options.
          </p>
        </div>

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor' | 'admin')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole });
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteRole('viewer');
                  }}
                  disabled={!inviteEmail || inviteMemberMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviteMemberMutation.isPending ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archive Confirmation Modal */}
        {showArchiveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Archive Project</h3>
                <button 
                  onClick={() => setShowArchiveModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600">
                  Are you sure you want to archive "<strong>{project?.name}</strong>"? 
                  The project will be hidden from your dashboard but can be restored later.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    archiveProjectMutation.mutate();
                    setShowArchiveModal(false);
                  }}
                  disabled={archiveProjectMutation.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {archiveProjectMutation.isPending ? 'Archiving...' : 'Archive Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-900">Delete Project</h3>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation({ projectName: '', password: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  This action cannot be undone. This will permanently delete the project 
                  "<strong>{project?.name}</strong>" and all associated data.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type the project name "{project?.name}" to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation.projectName}
                      onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, projectName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter your password to confirm:
                    </label>
                    <input
                      type="password"
                      value={deleteConfirmation.password}
                      onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation({ projectName: '', password: '' });
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteProjectMutation.mutate({
                      projectName: deleteConfirmation.projectName,
                      password: deleteConfirmation.password
                    });
                  }}
                  disabled={
                    deleteConfirmation.projectName !== project?.name || 
                    !deleteConfirmation.password || 
                    deleteProjectMutation.isPending
                  }
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteProjectMutation.isPending ? 'Deleting...' : 'I understand, delete this project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectSettingsPage;