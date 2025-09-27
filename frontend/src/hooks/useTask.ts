import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

export interface Task {
  _id: string;
  title: string;
  description?: string;
  project: string;
  column: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedTo: Array<{
    _id: string;
    fullName: string;
    username: string;
  }>;
  createdBy: {
    _id: string;
    fullName: string;
    username: string;
  };
  dueDate?: string;
  tags: string[];
  comments: Array<{
    _id: string;
    user: {
      _id: string;
      fullName: string;
      username: string;
    };
    content: string;
    createdAt: string;
  }>;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  column?: 'todo' | 'doing' | 'done';
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string[];
  dueDate?: string;
}

export interface UpdateTaskData {
  _id: string;
  title?: string;
  description?: string;
  column?: 'todo' | 'doing' | 'done';
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string[];
  dueDate?: string | null; // Allow null to explicitly clear the due date
}

export interface MoveTaskData {
  taskId: string;
  column: 'todo' | 'doing' | 'done';
  position?: number;
}

// Hook to fetch tasks for a specific project
export const useTasks = (projectId: string) => {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async (): Promise<Task[]> => {
      const response = await api.get(`/tasks/project/${projectId}`);
      const tasksByColumn = response.data.tasks;
      // Flatten the grouped tasks into a single array
      return [
        ...tasksByColumn.todo,
        ...tasksByColumn.doing,
        ...tasksByColumn.done
      ];
    },
    enabled: !!projectId,
  });
};

// Hook to fetch all tasks for dashboard (first task from each project)
export const useAllProjectTasks = () => {
  return useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: async () => {
      const response = await api.get('/tasks/dashboard');
      return response.data;
    },
  });
};

// Hook to fetch a single task
export const useTask = (taskId: string) => {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async (): Promise<Task> => {
      const response = await api.get(`/tasks/${taskId}`);
      return response.data.task;
    },
    enabled: !!taskId,
  });
};

// Hook to create a new task
export const useCreateTask = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: CreateTaskData): Promise<Task> => {
      const response = await api.post(`/tasks/project/${projectId}`, taskData);
      return response.data.task;
    },
    onSuccess: () => {
      // Invalidate and refetch tasks for this project
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      // Also invalidate dashboard tasks
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      toast.success('Task created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create task');
    },
  });
};

// Hook to update a task
export const useUpdateTask = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: UpdateTaskData): Promise<Task> => {
      const { _id, ...updateData } = taskData;
      const response = await api.put(`/tasks/${_id}`, updateData);
      return response.data.task;
    },
    onSuccess: (updatedTask) => {
      // Update the task in the cache
      queryClient.setQueryData(['task', updatedTask._id], updatedTask);
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      // Also invalidate dashboard tasks
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      toast.success('Task updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update task');
    },
  });
};

// Hook to move/reorder tasks (for drag and drop)
export const useMoveTask = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moveData: MoveTaskData): Promise<Task> => {
      const response = await api.put(`/tasks/${moveData.taskId}/move`, {
        column: moveData.column,
        position: moveData.position,
      });
      return response.data.task;
    },
    onSuccess: () => {
      // Invalidate tasks to refetch the new order
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to move task');
    },
  });
};

// Hook to delete a task
export const useDeleteTask = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string): Promise<void> => {
      await api.delete(`/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      toast.success('Task deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete task');
    },
  });
};

// Hook to add a comment to a task
export const useAddTaskComment = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }): Promise<Task> => {
      const response = await api.post(`/tasks/${taskId}/comments`, { content });
      return response.data.task;
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(['task', updatedTask._id], updatedTask);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Comment added successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    },
  });
};

// Hook to get project board settings (like doing column limit)
export const useBoardSettings = (projectId: string) => {
  return useQuery({
    queryKey: ['board-settings', projectId],
    queryFn: async (): Promise<{ doingLimit?: number }> => {
      const response = await api.get(`/projects/${projectId}/board-settings`);
      return response.data.settings;
    },
    enabled: !!projectId,
  });
};

// Hook to update board settings (admin only)
export const useUpdateBoardSettings = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: { doingLimit?: number }): Promise<{ doingLimit?: number }> => {
      const response = await api.put(`/projects/${projectId}/board-settings`, settings);
      return response.data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-settings', projectId] });
      toast.success('Board settings updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update board settings');
    },
  });
};

// Hook for real-time task updates
export const useRealTimeTaskUpdates = (projectId: string) => {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !projectId) return;

    // Join project room for real-time updates
    socket.emit('join-project', projectId);

    // Listen for task updates
    const handleTaskCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    };

    const handleTaskUpdated = (task: Task) => {
      // Update specific task in cache
      queryClient.setQueryData(['task', task._id], task);
      // Invalidate tasks list to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    };

    const handleTaskDeleted = (taskId: string) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      queryClient.removeQueries({ queryKey: ['task', taskId] });
    };

    const handleTaskMoved = (data: { taskId: string; oldColumn: string; newColumn: string; task: Task }) => {
      // Update specific task in cache
      queryClient.setQueryData(['task', data.taskId], data.task);
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    };

    const handleTaskCommentAdded = (data: { taskId: string; task: Task }) => {
      // Update specific task in cache with new comment
      queryClient.setQueryData(['task', data.taskId], data.task);
    };

    // Register event listeners
    socket.on('task-created', handleTaskCreated);
    socket.on('task-updated', handleTaskUpdated);
    socket.on('task-deleted', handleTaskDeleted);
    socket.on('task-moved', handleTaskMoved);
    socket.on('task-comment-added', handleTaskCommentAdded);

    return () => {
      // Clean up listeners
      socket.off('task-created', handleTaskCreated);
      socket.off('task-updated', handleTaskUpdated);
      socket.off('task-deleted', handleTaskDeleted);
      socket.off('task-moved', handleTaskMoved);
      socket.off('task-comment-added', handleTaskCommentAdded);
      
      // Leave project room
      socket.emit('leave-project', projectId);
    };
  }, [socket, projectId, queryClient]);
};