import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useSidebar } from '../../contexts/SidebarContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useProject } from '../../hooks/useProject';
import { 
  ViewColumnsIcon, 
  PlusIcon, 
  ExclamationTriangleIcon,
  RocketLaunchIcon 
} from '@heroicons/react/24/outline';

const ProjectBoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();

  const { project, isLoading } = useProject(projectId);

  // Get permissions using fresh project data
  const { can, isMember, userRole } = usePermissions(project);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600">
              Project Board - Kanban View
              {userRole && (
                <span className="ml-2 text-sm text-gray-500">
                  ({userRole} access)
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Add Task Button - Only for editors and admins */}
            {can.createTasks() && (
              <button className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Task
              </button>
            )}
            
            {/* View Toggle Buttons */}
            <div className="flex space-x-2">
              <button className="flex items-center px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">
                <ViewColumnsIcon className="h-4 w-4 mr-2" />
                Kanban
              </button>
            </div>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center max-w-2xl mx-auto">
            {/* Icon */}
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-teal-100 mb-6">
              <RocketLaunchIcon className="h-12 w-12 text-teal-600" />
            </div>
            
            {/* Content */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Project Board Coming Soon!
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              The Kanban board for managing tasks is currently under development. 
              This will be your central hub for organizing work across different stages 
              of your project workflow.
            </p>
            
            {/* Features Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <ViewColumnsIcon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Kanban Columns</h3>
                <p className="text-sm text-gray-600">Organize tasks in To Do, Doing, and Done columns</p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <PlusIcon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Task Management</h3>
                <p className="text-sm text-gray-600">Create, edit, and move tasks with drag & drop</p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Priority Levels</h3>
                <p className="text-sm text-gray-600">Set task priorities and track deadlines</p>
              </div>
            </div>

            {/* Action Message */}
            <div className="mt-8 p-4 bg-teal-50 rounded-lg border border-teal-200">
              <p className="text-teal-800 text-sm">
                <strong>Coming Soon:</strong> Full Kanban board functionality with task creation, 
                assignment, priority management, and real-time collaboration features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectBoardPage;
