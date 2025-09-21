import React from 'react';
import Layout from '../components/Layout';

const ProfilePage: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600">Manage your profile and account settings</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Profile Page</h2>
          <p className="text-gray-600">This page will allow users to view and edit their profile details and change passwords.</p>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
