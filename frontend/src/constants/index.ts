// Application constants and enums

export const TASK_COLUMNS = {
  TODO: 'todo',
  DOING: 'doing',
  DONE: 'done'
} as const;

export type TaskColumn = typeof TASK_COLUMNS[keyof typeof TASK_COLUMNS];

// Task column display information
export const TASK_COLUMN_INFO = {
  [TASK_COLUMNS.TODO]: {
    title: 'To Do',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    symbol: '○'
  },
  [TASK_COLUMNS.DOING]: {
    title: 'Doing',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    symbol: '◐'
  },
  [TASK_COLUMNS.DONE]: {
    title: 'Done',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    symbol: '●'
  }
} as const;

// User roles
export const USER_ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh'
  },
  PROJECTS: {
    BASE: '/projects',
    MEMBERS: (projectId: string) => `/projects/${projectId}/members`,
    ARCHIVE: (projectId: string) => `/projects/${projectId}/archive`,
    UNARCHIVE: (projectId: string) => `/projects/${projectId}/unarchive`
  },
  TASKS: {
    BASE: '/tasks',
    BY_PROJECT: (projectId: string) => `/tasks/project/${projectId}`
  },
  NOTES: {
    BASE: '/notes',
    BY_PROJECT: (projectId: string) => `/projects/${projectId}/notes`
  },
  NOTIFICATIONS: {
    BASE: '/notifications'
  }
} as const;

// React Query cache keys
export const QUERY_KEYS = {
  PROJECTS: 'projects',
  PROJECT: 'project',
  TASKS: 'tasks',
  NOTES: 'notes',
  NOTIFICATIONS: 'notifications',
  FRIENDS: 'friends',
  USERS: 'users',
  DASHBOARD_TASKS: 'dashboard-tasks',
  PROJECT_TASKS: 'project-tasks',
  BOOKMARKED_NOTES: 'bookmarked-notes',
  NOTES_ACTIVITY: 'notes-activity',
  BOARD_SETTINGS: 'board-settings',
  FRIEND_REQUESTS: 'friend-requests'
} as const;

// Socket events
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Project events
  JOIN_PROJECT: 'join_project',
  LEAVE_PROJECT: 'leave_project',
  PROJECT_CREATED: 'project_created',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_DELETED: 'project_deleted',
  PROJECT_INFO_UPDATED: 'project_info_updated',
  
  // Member events
  MEMBER_ADDED: 'member_added',
  MEMBER_REMOVED: 'member_removed',
  ROLE_CHANGED: 'role_changed',
  
  // Task events
  TASK_CREATED: 'task-created',
  TASK_UPDATED: 'task-updated',
  TASK_DELETED: 'task-deleted',
  TASK_MOVED: 'task-moved',
  TASK_COMMENT_ADDED: 'task-comment-added',
  
  // Note events
  NOTE_CREATED: 'note-created',
  NOTE_UPDATED: 'note-updated',
  NOTE_DELETED: 'note-deleted',
  
  // Notification events
  NOTIFICATION_RECEIVED: 'notification_received',
  NOTIFICATIONS_UPDATED: 'notifications_updated',
  
  // Friend events
  FRIENDS_UPDATED: 'friends_updated',
  FRIEND_REQUESTS_UPDATED: 'friend_requests_updated',
  FRIEND_REQUEST_RECEIVED: 'friend_request_received'
} as const;

// Application limits and defaults
export const APP_LIMITS = {
  MAX_PROJECT_NAME_LENGTH: 100,
  MAX_PROJECT_DESCRIPTION_LENGTH: 500,
  MAX_TASK_TITLE_LENGTH: 200,
  MAX_TASK_DESCRIPTION_LENGTH: 1000,
  MAX_NOTE_TITLE_LENGTH: 200,
  DEFAULT_DOING_COLUMN_LIMIT: 5,
  MIN_DOING_COLUMN_LIMIT: 1,
  MAX_DOING_COLUMN_LIMIT: 20
} as const;

// Default values
export const DEFAULTS = {
  TASK_COLUMN: TASK_COLUMNS.TODO,
  USER_ROLE: USER_ROLES.VIEWER,
  QUERY_STALE_TIME: 30 * 1000, // 30 seconds
  QUERY_GC_TIME: 5 * 60 * 1000, // 5 minutes
  JWT_EXPIRES_IN: '7d'
} as const;