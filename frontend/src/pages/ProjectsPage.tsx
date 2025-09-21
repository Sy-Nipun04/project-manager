import React from 'react';
import Layout from '../components/Layout';

const ProjectsPage: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage your projects and teams</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Projects Page</h2>
          <p className="text-gray-600">This page will show the list of projects with expandable details and create project functionality.</p>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectsPage;
