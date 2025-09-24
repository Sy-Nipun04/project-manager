import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getRoleDisplayInfo } from '../../lib/permissions';
import { 
  CogIcon,
  UserIcon,
  BellIcon,
  ShieldCheckIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  KeyIcon,
  GlobeAltIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';

const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const { can, isMember, userRole } = usePermissions();
  const [activeTab, setActiveTab] = useState('general');

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}`);
      return response.data.project;
    },
    enabled: !!projectId
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
  const canManageSettings = can.editProjectInfo();

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'members', name: 'Team & Permissions', icon: UserIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'privacy', name: 'Privacy & Security', icon: ShieldCheckIcon },
    { id: 'advanced', name: 'Advanced', icon: ExclamationTriangleIcon }
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={project.name}
              disabled={!canManageSettings}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              rows={3}
              value={project.description || ''}
              disabled={!canManageSettings}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none"
              placeholder="Project description..."
            />
          </div>
        </div>
        {!canManageSettings && (
          <p className="text-sm text-gray-500 mt-4">
            You need admin permissions to edit project information.
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-gray-900">Active</p>
              <p className="text-sm text-gray-500">Project is active and accessible to all members</p>
            </div>
          </div>
          {canManageSettings && (
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
              Change Status
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderMembersSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          {can.addMembers() && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Invite Members
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {project.members?.map((member: any, index: number) => {
            const roleInfo = getRoleDisplayInfo(member.role);
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {member.user?.fullName?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.user?.fullName || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500">@{member.user?.username || 'unknown'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleInfo.color} ${roleInfo.bgColor}`}>
                    {roleInfo.label}
                  </span>
                  {can.addMembers() && member.user?._id !== project.creator && (
                    <button className="text-gray-400 hover:text-red-600">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

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

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      {canManageSettings && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Archive Project</h3>
            <div className="flex items-start space-x-3">
              <ArchiveBoxIcon className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-gray-900 mb-2">
                  Archive this project to make it read-only. Archived projects can be restored later.
                </p>
                <button className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700">
                  Archive Project
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
                  <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                    Delete Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!canManageSettings && (
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
      </div>
    </Layout>
  );
};

export default ProjectSettingsPage;