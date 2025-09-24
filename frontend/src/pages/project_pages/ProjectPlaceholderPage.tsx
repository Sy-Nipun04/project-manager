import React from 'react';
import Layout from '../../components/Layout';
import { FolderOpen, ArrowRight, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const SelectProjectPage: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateProject = () => {
    navigate('/projects', { state: { openCreateModal: true } });
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="max-w-md mx-auto">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-gray-100 mb-8">
            <FolderOpen className="h-12 w-12 text-gray-400" />
          </div>
          
          {/* Content */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Select a project to view project content
          </h1>
          <p className="text-gray-600 mb-8">
            Choose a project from the sidebar dropdown to access its board, information, team details, notes, and settings.
          </p>
          
          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/projects"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 transition-colors"
              >
                View All Projects
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              
              <button
                onClick={handleCreateProject}
                className="inline-flex items-center px-6 py-3 border border-teal-600 text-teal-600 text-base font-medium rounded-lg hover:bg-teal-50 transition-colors"
              >
                Create New Project
                <Plus className="ml-2 h-4 w-4" />
              </button>
            </div>
            
            <div className="text-center">
              <Link
                to="/dashboard"
                className="text-teal-600 hover:text-teal-700 text-sm font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SelectProjectPage;