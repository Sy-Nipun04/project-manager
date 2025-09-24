// Role-based access control utilities

export type UserRole = 'viewer' | 'editor' | 'admin';

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

// Check if user has minimum required role
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Check if user can perform specific actions
export const permissions = {
  // Project management
  canEditProjectInfo: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canArchiveProject: (role: UserRole) => hasMinimumRole(role, 'admin'),
  canDeleteProject: (role: UserRole) => hasMinimumRole(role, 'admin'),
  canManageSettings: (role: UserRole) => hasMinimumRole(role, 'admin'),
  
  // Team management
  canAddMembers: (role: UserRole) => hasMinimumRole(role, 'admin'),
  canRemoveMembers: (role: UserRole) => hasMinimumRole(role, 'admin'),
  canAssignRoles: (role: UserRole) => hasMinimumRole(role, 'admin'),
  canViewTeam: (role: UserRole) => hasMinimumRole(role, 'viewer'),
  
  // Task management
  canCreateTasks: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canEditTasks: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canDeleteTasks: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canMoveTasksAcrossColumns: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canViewTasks: (role: UserRole) => hasMinimumRole(role, 'viewer'),
  
  // Notes management
  canCreateNotes: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canEditNotes: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canDeleteNotes: (role: UserRole) => hasMinimumRole(role, 'editor'),
  canViewNotes: (role: UserRole) => hasMinimumRole(role, 'viewer'),
};

// Get user role from project member data
export function getUserRoleInProject(
  userId: string,
  members: Array<{ user: { _id: string } | string; role: UserRole }>
): UserRole | null {
  const member = members.find(m => {
    const memberId = typeof m.user === 'string' ? m.user : m.user._id;
    return memberId === userId;
  });
  return member ? member.role : null;
}

// Check if user is project creator
export function isProjectCreator(userId: string, creatorId: string): boolean {
  return userId === creatorId;
}

// Get role display information
export function getRoleDisplayInfo(role: UserRole) {
  const roleInfo = {
    viewer: {
      label: 'Viewer',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      description: 'Can view project content'
    },
    editor: {
      label: 'Editor', 
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Can view and edit project content'
    },
    admin: {
      label: 'Admin',
      color: 'text-purple-600', 
      bgColor: 'bg-purple-100',
      description: 'Full access to project and team management'
    }
  };
  
  return roleInfo[role];
}

// Permission error messages
export const PERMISSION_ERRORS = {
  INSUFFICIENT_ROLE: 'You do not have permission to perform this action',
  NOT_PROJECT_MEMBER: 'You are not a member of this project',
  UNKNOWN_ERROR: 'An error occurred while checking permissions'
};