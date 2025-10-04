import React, { useState } from 'react';
import Layout from '../components/Layout';
import { UserIcon, CogIcon } from '@heroicons/react/24/outline';

const ProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');

  const tabs = [
    {
      id: 'profile' as const,
      name: 'Profile',
      icon: UserIcon,
      description: 'View and edit your profile information'
    },
    {
      id: 'settings' as const,
      name: 'Settings',
      icon: CogIcon,
      description: 'Manage account settings and preferences'
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account</h1>
          <p className="text-gray-600">Manage your profile and account settings</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-teal-500 text-teal-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Profile Information</h2>
                  <p className="text-gray-600 mb-4">View and edit your personal profile details.</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Section</h3>
                  <p className="text-gray-600">
                    This section will allow users to view and edit their profile details such as name, email, 
                    profile picture, and other personal information.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Settings</h2>
                  <p className="text-gray-600 mb-4">Manage your account settings and preferences.</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Settings Section</h3>
                  <p className="text-gray-600">
                    This section will allow users to manage account settings such as password changes, 
                    notification preferences, privacy settings, and other account configurations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
