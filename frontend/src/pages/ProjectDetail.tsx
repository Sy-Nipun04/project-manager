import React from 'react';
import Layout from '../components/Layout';

const ProjectDetail: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Detail</h1>
          <p className="text-gray-600">Project management interface with sidebar and Kanban board</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Project Detail Page</h2>
          <p className="text-gray-600">This page will contain the collapsible sidebar with Board, Project Info, Team Info, Notes, and Settings.</p>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectDetail;
