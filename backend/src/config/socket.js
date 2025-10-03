import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const setupSocketHandlers = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.fullName} connected with socket ${socket.id}`);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    });

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Handle joining project rooms
    socket.on('join_project', (projectId) => {
      socket.join(`project_${projectId}`);
      console.log(`User ${socket.user.fullName} joined project ${projectId}`);
    });

    // Handle leaving project rooms
    socket.on('leave_project', (projectId) => {
      socket.leave(`project_${projectId}`);
      console.log(`User ${socket.user.fullName} left project ${projectId}`);
    });

    // Handle task updates
    socket.on('task_updated', (data) => {
      // Broadcast to all users in the project
      socket.to(`project_${data.projectId}`).emit('task_updated', {
        ...data,
        updatedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle task created
    socket.on('task_created', (data) => {
      socket.to(`project_${data.projectId}`).emit('task_created', {
        ...data,
        createdBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle task moved
    socket.on('task_moved', (data) => {
      socket.to(`project_${data.projectId}`).emit('task_moved', {
        ...data,
        movedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle task deleted
    socket.on('task_deleted', (data) => {
      socket.to(`project_${data.projectId}`).emit('task_deleted', {
        ...data,
        deletedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle note created
    socket.on('note_created', (data) => {
      socket.to(`project_${data.projectId}`).emit('note_created', {
        ...data,
        createdBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle note updated
    socket.on('note_updated', (data) => {
      socket.to(`project_${data.projectId}`).emit('note_updated', {
        ...data,
        updatedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle member added
    socket.on('member_added', (data) => {
      socket.to(`project_${data.projectId}`).emit('member_added', {
        ...data,
        addedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle member removed
    socket.on('member_removed', (data) => {
      socket.to(`project_${data.projectId}`).emit('member_removed', {
        ...data,
        removedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle role changed
    socket.on('role_changed', (data) => {
      socket.to(`project_${data.projectId}`).emit('role_changed', {
        ...data,
        changedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle project settings updated
    socket.on('project_updated', (data) => {
      socket.to(`project_${data.projectId}`).emit('project_updated', {
        ...data,
        updatedBy: {
          id: socket.user._id,
          name: socket.user.fullName,
          username: socket.user.username
        }
      });
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      socket.to(`project_${data.projectId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(`project_${data.projectId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        isTyping: false
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.fullName} disconnected`);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });
    });
  });
};

// Helper function to emit notifications to specific users
export const emitNotification = (io, userId, notification) => {
  if (io && userId) {
    console.log('🔔 Emitting notification to user:', userId, notification.type);
    io.to(userId.toString()).emit('notification_received', notification);
  }
};

// Helper function to emit to project members
export const emitToProject = (io, projectId, event, data) => {
  io.to(`project_${projectId}`).emit(event, data);
};

// Helper function to emit to all project members (both in room and individual user rooms)
export const emitToProjectMembers = async (io, projectId, event, data) => {
  try {
    // First emit to project room (for users actively viewing the project)
    io.to(`project_${projectId}`).emit(event, data);
    
    // Then get all project members and emit to their personal rooms
    // This ensures users on dashboard/other pages also receive updates
    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findById(projectId).populate('members.user', '_id');
    
    if (project && project.members) {
      project.members.forEach(member => {
        const userId = member.user._id.toString();
        // Emit to each member's personal room
        io.to(`user_${userId}`).emit(event, data);
      });
    }
  } catch (error) {
    console.error('Error emitting to project members:', error);
    // Fallback to just project room
    io.to(`project_${projectId}`).emit(event, data);
  }
};
