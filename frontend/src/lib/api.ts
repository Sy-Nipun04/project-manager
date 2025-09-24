import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth and permission errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      // Permission denied - enhance error with user-friendly message
      const originalError = error.response.data?.message || 'Access denied';
      error.response.data = {
        ...error.response.data,
        message: originalError,
        userFriendlyMessage: getUserFriendlyPermissionMessage(originalError)
      };
    }
    return Promise.reject(error);
  }
);

// Helper function to convert backend permission errors to user-friendly messages
function getUserFriendlyPermissionMessage(backendMessage: string): string {
  if (backendMessage.includes('not a member')) {
    return 'You are not a member of this project. Contact an admin to be added.';
  }
  
  if (backendMessage.includes('Required role: admin')) {
    return 'This action requires admin permissions. Contact an admin for access.';
  }
  
  if (backendMessage.includes('Required role: editor')) {
    return 'This action requires editor permissions or higher.';
  }
  
  if (backendMessage.includes('Access denied')) {
    return 'You do not have permission to perform this action.';
  }
  
  return 'Permission denied. You may need different role permissions for this action.';
}

export default api;
