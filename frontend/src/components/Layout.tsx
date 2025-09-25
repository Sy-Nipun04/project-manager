import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { api } from '../lib/api';
import CollapsibleSidebar from './CollapsibleSidebar';
import { 
  Home, 
  FolderOpen, 
  Users, 
  Bell, 
  User, 
  LogOut, 
  Menu, 
  X,
  Settings
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);
  const { user, logout } = useAuth();
  const { isOpen, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (user) {
        try {
          const response = await api.get('/notifications?limit=0&unreadOnly=true');
          setUnreadNotificationsCount(response.data.pagination?.unreadCount || 0);
        } catch (error) {
          // Silently fail - notification indicator is not critical
          console.error('Failed to fetch unread notifications count:', error);
        }
      }
    };

    const fetchPendingFriendRequests = async () => {
      if (user) {
        try {
          const response = await api.get('/users/friend-requests');
          setPendingFriendRequestsCount(response.data.length);
        } catch (error) {
          // Silently fail - friend request indicator is not critical
          console.error('Failed to fetch pending friend requests count:', error);
        }
      }
    };

    fetchUnreadCount();
    fetchPendingFriendRequests();
    
    // Refresh counts when navigating
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchPendingFriendRequests();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Projects', href: '/projects', icon: FolderOpen },
    { name: 'Social', href: '/social', icon: Users, badge: pendingFriendRequestsCount },
    { name: 'Notifications', href: '/notifications', icon: Bell, badge: unreadNotificationsCount },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <CollapsibleSidebar />
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isOpen ? 'lg:ml-80' : 'lg:ml-16'}`}>
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                {/* Sidebar toggle button */}
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors mr-4"
                >
                  <Menu className="h-5 w-5 text-gray-600" />
                </button>
                
                {/* Logo */}
                <Link to="/dashboard" className="flex items-center">
                  <div className="h-8 w-8 bg-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">P</span>
                  </div>
                  <span className="ml-2 text-xl font-bold text-gray-900">Project Manager</span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:ml-8 md:flex md:space-x-8">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const badgeCount = item.badge || 0;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors relative ${
                          isActive(item.href)
                            ? 'text-teal-600 border-b-2 border-teal-600'
                            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.name}
                        {badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 bg-red-600 rounded-full min-w-[1.25rem] h-5">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  <div className="h-8 w-8 bg-teal-600 rounded-full flex items-center justify-center">
                    {user?.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt={user.fullName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-medium text-sm">
                        {user?.fullName?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="hidden md:block text-gray-700 font-medium">
                    {user?.fullName}
                  </span>
                </button>

                {/* Profile dropdown menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
              {navigation.map((item) => {
                const Icon = item.icon;
                const badgeCount = item.badge || 0;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center justify-between px-4 py-2 text-base font-medium transition-colors relative ${
                      isActive(item.href)
                        ? 'text-teal-600 bg-teal-50 border-r-2 border-teal-600'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <Icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </div>
                    {badgeCount > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem] h-5">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

        {/* Main content */}
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
