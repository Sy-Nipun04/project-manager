import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { getUserRoleInProject, isProjectCreator, permissions, PERMISSION_ERRORS } from '../lib/permissions';
import type { UserRole } from '../lib/permissions';

// Custom hook for permission checking
export function usePermissions(project?: any) {
  const { user } = useAuth();
  const { selectedProject } = useSidebar();
  
  // Use provided project or selected project
  const currentProject = project || selectedProject;
  
  // Get user's role in current project
  const userRole: UserRole | null = currentProject && user
    ? getUserRoleInProject(user.id, currentProject.members)
    : null;
  
  // Check if user is the project creator
  const isCreator = currentProject && user
    ? isProjectCreator(user.id, currentProject.creator._id || currentProject.creator)
    : false;
  
  // Check if user is a member of the project
  const isMember = userRole !== null;
  
  // Permission checking functions
  const can = {
    // Project management
    editProjectInfo: () => userRole && permissions.canEditProjectInfo(userRole),
    archiveProject: () => userRole && permissions.canArchiveProject(userRole),
    deleteProject: () => userRole && permissions.canDeleteProject(userRole),
    manageSettings: () => userRole && permissions.canManageSettings(userRole),
    
    // Team management  
    addMembers: () => userRole && permissions.canAddMembers(userRole),
    removeMembers: () => userRole && permissions.canRemoveMembers(userRole),
    assignRoles: () => userRole && permissions.canAssignRoles(userRole),
    viewTeam: () => userRole && permissions.canViewTeam(userRole),
    
    // Task management
    createTasks: () => userRole && permissions.canCreateTasks(userRole),
    editTasks: () => userRole && permissions.canEditTasks(userRole),
    deleteTasks: () => userRole && permissions.canDeleteTasks(userRole),
    moveTasksAcrossColumns: () => userRole && permissions.canMoveTasksAcrossColumns(userRole),
    viewTasks: () => userRole && permissions.canViewTasks(userRole),
    
    // Notes management
    createNotes: () => userRole && permissions.canCreateNotes(userRole),
    editNotes: () => userRole && permissions.canEditNotes(userRole),
    deleteNotes: () => userRole && permissions.canDeleteNotes(userRole),
    viewNotes: () => userRole && permissions.canViewNotes(userRole),
  };
  
  // Helper function to require permission (throws error if not allowed)
  const requirePermission = (action: keyof typeof can) => {
    if (!isMember) {
      throw new Error(PERMISSION_ERRORS.NOT_PROJECT_MEMBER);
    }
    if (!can[action]()) {
      throw new Error(PERMISSION_ERRORS.INSUFFICIENT_ROLE);
    }
  };
  
  return {
    userRole,
    isCreator,
    isMember,
    can,
    requirePermission,
    project: currentProject
  };
}

// Higher-order component for protecting routes/components with permissions
export function withPermissions<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  requiredPermission: keyof ReturnType<typeof usePermissions>['can'],
  FallbackComponent?: React.ComponentType
) {
  return function PermissionWrappedComponent(props: T) {
    const { can, isMember } = usePermissions();
    
    if (!isMember) {
      return FallbackComponent ? <FallbackComponent /> : (
        <div className="p-4 text-center">
          <p className="text-gray-500">You are not a member of this project.</p>
        </div>
      );
    }
    
    if (!can[requiredPermission]()) {
      return FallbackComponent ? <FallbackComponent /> : (
        <div className="p-4 text-center">
          <p className="text-gray-500">You do not have permission to access this feature.</p>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}