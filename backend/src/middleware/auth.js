import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const checkProjectAccess = (requiredRole = 'viewer') => {
  return async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;

      const Project = (await import('../models/Project.js')).default;
      const project = await Project.findById(projectId).populate('members.user', 'fullName username email');

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const member = project.members.find(m => m.user._id.toString() === userId.toString());
      
      if (!member) {
        return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
      }

      // Check role hierarchy: admin > editor > viewer
      const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[member.role];
      const requiredRoleLevel = roleHierarchy[requiredRole];

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({ 
          message: `Access denied. Required role: ${requiredRole}, your role: ${member.role}` 
        });
      }

      req.project = project;
      req.memberRole = member.role;
      req.isProjectCreator = project.creator.toString() === userId.toString();
      next();
    } catch (error) {
      console.error('Project access check error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

export const checkProjectAdmin = checkProjectAccess('admin');
export const checkProjectEditor = checkProjectAccess('editor');
export const checkProjectViewer = checkProjectAccess('viewer');

// Specific permission checks
export const canManageTeam = checkProjectAccess('admin');
export const canEditProject = checkProjectAccess('editor');
export const canManageTasks = checkProjectAccess('editor');
export const canViewProject = checkProjectAccess('viewer');

// Task-specific permissions
export const canCreateTasks = checkProjectAccess('editor');
export const canEditTasks = checkProjectAccess('editor');
export const canDeleteTasks = checkProjectAccess('editor');

// Notes-specific permissions
export const canCreateNotes = checkProjectAccess('editor');
export const canEditNotes = checkProjectAccess('editor');
export const canDeleteNotes = checkProjectAccess('editor');

// Task-specific middleware that checks project access via task ID
export const checkTaskAccess = (requiredRole = 'viewer') => {
  return async (req, res, next) => {
    try {
      const { taskId } = req.params;
      const userId = req.user._id;

      // Import Task model dynamically to avoid circular imports
      const Task = (await import('../models/Task.js')).default;
      const Project = (await import('../models/Project.js')).default;

      // Find the task first
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      // Find the project associated with the task
      const project = await Project.findById(task.project).populate('members.user', 'fullName username email');
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const member = project.members.find(m => m.user._id.toString() === userId.toString());
      
      if (!member) {
        return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
      }

      // Check role hierarchy: admin > editor > viewer
      const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[member.role];
      const requiredRoleLevel = roleHierarchy[requiredRole];

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({ 
          message: `Access denied. Required role: ${requiredRole}, your role: ${member.role}` 
        });
      }

      req.task = task;
      req.project = project;
      req.memberRole = member.role;
      req.isProjectCreator = project.creator.toString() === userId.toString();
      next();
    } catch (error) {
      console.error('Task access check error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

// Task-specific permission shortcuts
export const checkTaskEditor = checkTaskAccess('editor');
export const checkTaskViewer = checkTaskAccess('viewer');
