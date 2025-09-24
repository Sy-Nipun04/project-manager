import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Project {
  _id: string;
  name: string;
  description?: string;
  creator: {
    _id: string;
    fullName: string;
    username: string;
  };
  members: Array<{
    user: {
      _id: string;
      fullName: string;
      username: string;
    };
    role: string;
  }>;
  updatedAt: string;
}

interface SidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  toggleSidebar: () => void;
  validateSelectedProject: (availableProjects: Project[]) => void;
  resetSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(() => {
    // Check localStorage for sidebar state, default to closed on mobile, open on desktop
    const saved = localStorage.getItem('sidebarIsOpen');
    if (saved !== null) return JSON.parse(saved);
    return window.innerWidth >= 1024; // lg breakpoint
  });
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    // Try to restore selected project from localStorage
    const saved = localStorage.getItem('selectedProject');
    return saved ? JSON.parse(saved) : null;
  });

  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    localStorage.setItem('sidebarIsOpen', JSON.stringify(newState));
  };

  const resetSidebar = () => {
    // Reset sidebar state to default values
    setSelectedProject(null);
    setIsOpen(window.innerWidth >= 1024); // Reset to default based on screen size
  };

  // Listen for logout events to reset sidebar state
  useEffect(() => {
    const handleLogout = () => {
      resetSidebar();
    };

    window.addEventListener('user-logout', handleLogout);
    
    return () => {
      window.removeEventListener('user-logout', handleLogout);
    };
  }, []);

  const validateSelectedProject = (availableProjects: Project[]) => {
    // If no projects available and there's a selected project, clear it
    if (availableProjects.length === 0 && selectedProject) {
      console.log('No projects available, clearing selected project');
      setSelectedProject(null);
      return;
    }
    
    // If selected project doesn't exist in available projects, clear it
    if (selectedProject && !availableProjects.find(p => p._id === selectedProject._id)) {
      console.log('Selected project no longer exists in available projects, clearing selection');
      setSelectedProject(null);
    }
  };

  // Persist selected project to localStorage
  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('selectedProject', JSON.stringify(selectedProject));
    } else {
      localStorage.removeItem('selectedProject');
    }
  }, [selectedProject]);

  // Expose method to manually clear project data (for debugging)
  useEffect(() => {
    // @ts-ignore - Add function to window for debugging
    window.clearProjectData = () => {
      localStorage.removeItem('selectedProject');
      setSelectedProject(null);
      console.log('Project data cleared from localStorage');
    };
    
    return () => {
      // @ts-ignore
      delete window.clearProjectData;
    };
  }, []);

  const value: SidebarContextType = {
    isOpen,
    setIsOpen,
    selectedProject,
    setSelectedProject,
    toggleSidebar,
    validateSelectedProject,
    resetSidebar,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};