import React from 'react';
import Layout from '../components/Layout';

const NotificationsPage: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Stay updated with project activities and invitations</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notifications Page</h2>
          <p className="text-gray-600">This page will show notifications for invitations, tasks, notes, and team updates.</p>
        </div>
      </div>
    </Layout>
  );
};

export default NotificationsPage;
