import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Centralized hook for fetching project data
 * Serves as single source of truth for project information across all components
 * 
 * @param projectId - The ID of the project to fetch
 * @returns Query object with project data and utilities
 */
export function useProject(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required');
      
      const response = await api.get(`/projects/${projectId}`);
      return response.data.project;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes - project data doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer for better UX
  });

  /**
   * Invalidate project cache to force refresh
   * Use this when project data has changed
   */
  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  };

  /**
   * Update project data optimistically in cache
   * Use this for immediate UI updates before server response
   */
  const updateProjectOptimistically = (updater: (oldProject: any) => any) => {
    queryClient.setQueryData(['project', projectId], updater);
  };

  /**
   * Get cached project data without triggering a fetch
   * Useful for accessing current project state in mutations
   */
  const getCachedProject = () => {
    return queryClient.getQueryData(['project', projectId]);
  };

  return {
    ...query,
    project: query.data,
    invalidateProject,
    updateProjectOptimistically,
    getCachedProject,
  };
}

/**
 * Hook for accessing projects list (used in sidebar and projects page)
 * Centralized to ensure consistency across components
 */
export function useProjects() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data.projects;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - projects list changes more frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Invalidate projects list cache
   * Use when projects are created, deleted, or user joins/leaves projects
   */
  const invalidateProjects = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    // Also invalidate user-specific projects query used in sidebar
    queryClient.invalidateQueries({ queryKey: ['projects', 'user'] });
  };

  /**
   * Add project optimistically to the list
   * Use for immediate UI updates when creating projects
   */
  const addProjectOptimistically = (newProject: any) => {
    queryClient.setQueryData(['projects'], (oldProjects: any[] = []) => [
      newProject,
      ...oldProjects
    ]);
  };

  /**
   * Remove project optimistically from the list
   * Use for immediate UI updates when leaving/deleting projects
   */
  const removeProjectOptimistically = (projectId: string) => {
    queryClient.setQueryData(['projects'], (oldProjects: any[] = []) =>
      oldProjects.filter(p => p._id !== projectId)
    );
  };

  return {
    ...query,
    projects: query.data || [],
    invalidateProjects,
    addProjectOptimistically,
    removeProjectOptimistically,
  };
}

/**
 * Hook for accessing sidebar-specific projects data
 * This is separate to handle user-specific queries and avoid conflicts
 */
export function useSidebarProjects(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects', userId],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data.projects;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  /**
   * Invalidate sidebar projects cache
   * Use when user accepts invitations or project membership changes
   */
  const invalidateSidebarProjects = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', userId] });
    // Also invalidate the main projects list
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  return {
    ...query,
    projects: query.data || [],
    invalidateSidebarProjects,
  };
}