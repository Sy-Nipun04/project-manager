import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  ViewColumnsIcon,
  InformationCircleIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface SidebarItemProps {
  title: string;
  icon: React.ReactNode;
  href: string;
  isCollapsed: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  title, 
  icon, 
  href,
  isCollapsed 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProject } = useSidebar();

  const handleClick = () => {
    if (!selectedProject) {
      // If no project is selected, navigate to select-project page
      // But only if we're not already there
      if (location.pathname !== '/select-project') {
        navigate('/select-project');
      }
      return;
    }
    // Navigate to the specific project page
    navigate(href);
  };

  // Check if this item is active based on current path
  const isActive = React.useMemo(() => {
    // If no project is selected, no sidebar items should be active (except select-project page)
    if (!selectedProject) {
      return false;
    }
    
    // Only show active state if we're actually on a project page with the correct project
    if (!location.pathname.includes(`/project/${selectedProject._id}`)) {
      return false;
    }
    
    // For project-specific routes, check if the current path matches the route segment
    if (href.includes('/board')) return location.pathname.includes('/board');
    if (href.includes('/info')) return location.pathname.includes('/info');
    if (href.includes('/team')) return location.pathname.includes('/team');
    if (href.includes('/notes')) return location.pathname.includes('/notes');
    if (href.includes('/settings')) return location.pathname.includes('/settings');
    
    return false;
  }, [location.pathname, href, selectedProject]);

  if (isCollapsed) {
    return (
      <div className="relative group mb-2">
        <button 
          onClick={handleClick}
          className={`w-full p-3 flex items-center justify-center rounded-lg transition-all duration-200 ${
            isActive 
              ? 'bg-teal-100 text-teal-700 shadow-sm border border-teal-200' 
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        </button>
        <div className="absolute left-full top-0 ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
          {title}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center space-x-3 p-3 text-left rounded-lg transition-all duration-200 mb-2 ${
        isActive
          ? 'bg-teal-100 text-teal-700 font-semibold shadow-sm border border-teal-200'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="font-medium">{title}</span>
    </button>
  );
};

const CollapsibleSidebar: React.FC = () => {
  const { isOpen, toggleSidebar, selectedProject, setSelectedProject, validateSelectedProject } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: projects } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data.projects;
    },
    enabled: !!user, // Only fetch when user is authenticated
  });

  // Listen for logout events to clear query cache
  React.useEffect(() => {
    const handleLogout = () => {
      // Clear all cached queries
      queryClient.clear();
    };

    window.addEventListener('user-logout', handleLogout);
    
    return () => {
      window.removeEventListener('user-logout', handleLogout);
    };
  }, [queryClient]);

  // Auto-sync selected project based on current URL and validate stored project
  React.useEffect(() => {
    if (projects) {
      // Validate selected project against available projects
      validateSelectedProject(projects);

      // Auto-sync selected project based on current URL
      const pathMatch = location.pathname.match(/\/project\/([^\/]+)/);
      if (pathMatch) {
        const projectId = pathMatch[1];
        const project = projects.find((p: any) => p._id === projectId);
        if (project && (!selectedProject || selectedProject._id !== projectId)) {
          setSelectedProject(project);
        } else if (!project) {
          // Project from URL doesn't exist, navigate to select-project
          navigate('/select-project');
        }
      }
    }
  }, [location.pathname, projects, selectedProject, setSelectedProject, validateSelectedProject, navigate]);

  const handleProjectChange = (projectId: string) => {
    const project = projects?.find((p: any) => p._id === projectId);
    setSelectedProject(project || null);
    
    if (project) {
      // Determine which route to navigate to based on current path
      // This preserves the current sidebar section when changing projects
      const currentPath = location.pathname;
      let targetRoute = 'board'; // default to board
      
      if (currentPath.includes('/info')) {
        targetRoute = 'info';
      } else if (currentPath.includes('/team')) {
        targetRoute = 'team';
      } else if (currentPath.includes('/notes')) {
        targetRoute = 'notes';
      } else if (currentPath.includes('/settings')) {
        targetRoute = 'settings';
      }
      
      navigate(`/project/${project._id}/${targetRoute}`);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50
        ${isOpen ? 'w-80' : 'w-16'}
        bg-white border-r border-gray-200 
        transition-all duration-300 ease-in-out
        flex flex-col
        shadow-lg
        max-h-screen overflow-hidden
      `}>
        {/* Header with Project Dropdown */}
        <div className="p-4 border-b border-gray-200">
          {isOpen ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Project Board</h2>
                <button
                  onClick={toggleSidebar}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeftIcon className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              
              {/* Project Selector Dropdown */}
              <select
                value={selectedProject?._id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleProjectChange(e.target.value);
                  } else {
                    setSelectedProject(null);
                    // Only navigate to select-project if we're not already there
                    if (location.pathname !== '/select-project') {
                      navigate('/select-project');
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">
                  {projects?.length === 0 ? 'No projects available' : 'Select a project...'}
                </option>
                {projects?.map((project: any) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRightIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <SidebarItem
            title="Board"
            icon={<ViewColumnsIcon className="h-5 w-5 text-blue-600" />}
            href={selectedProject ? `/project/${selectedProject._id}/board` : '/select-project'}
            isCollapsed={!isOpen}
          />
          
          <SidebarItem
            title="Project Info"
            icon={<InformationCircleIcon className="h-5 w-5 text-green-600" />}
            href={selectedProject ? `/project/${selectedProject._id}/info` : '/select-project'}
            isCollapsed={!isOpen}
          />
          
          <SidebarItem
            title="Team Info"
            icon={<UsersIcon className="h-5 w-5 text-purple-600" />}
            href={selectedProject ? `/project/${selectedProject._id}/team` : '/select-project'}
            isCollapsed={!isOpen}
          />
          
          <SidebarItem
            title="Notes"
            icon={<DocumentTextIcon className="h-5 w-5 text-yellow-600" />}
            href={selectedProject ? `/project/${selectedProject._id}/notes` : '/select-project'}
            isCollapsed={!isOpen}
          />
          
          <SidebarItem
            title="Settings"
            icon={<Cog6ToothIcon className="h-5 w-5 text-gray-600" />}
            href={selectedProject ? `/project/${selectedProject._id}/settings` : '/select-project'}
            isCollapsed={!isOpen}
          />
        </div>

        {/* Footer */}
        {isOpen && selectedProject && projects?.find((p: any) => p._id === selectedProject._id) && (
          <div className="border-t border-gray-200 p-4">
            <div className="text-xs text-gray-500">
              <p className="font-medium mb-1">{selectedProject.name}</p>
              <p>Members: {selectedProject.members?.length || 0}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CollapsibleSidebar;