import express from 'express';
import { body, validationResult } from 'express-validator';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import { checkProjectAccess, checkProjectEditor, checkProjectAdmin, checkTaskEditor, checkTaskViewer } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard tasks (first doing task from 5 most recently updated projects)
router.get('/dashboard', async (req, res) => {
  try {
    // Get 5 most recently updated projects where user is a member
    const projects = await Project.find({
      'members.user': req.user._id
    })
    .select('_id name updatedAt')
    .sort({ updatedAt: -1 })
    .limit(5);

    const dashboardTasks = [];

    // Get the first doing task from each of these projects
    for (const project of projects) {
      const firstDoingTask = await Task.findOne({
        project: project._id,
        column: 'doing',
        isArchived: false
      })
      .populate('assignedTo', 'fullName username email profileImage')
      .populate('createdBy', 'fullName username email profileImage')
      .sort({ position: 1, createdAt: 1 });

      if (firstDoingTask) {
        dashboardTasks.push({
          ...firstDoingTask.toObject(),
          projectName: project.name
        });
      }
    }

    res.json({ tasks: dashboardTasks });
  } catch (error) {
    console.error('Get dashboard tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tasks for a project
router.get('/project/:projectId', checkProjectAccess('viewer'), async (req, res) => {
  try {
    const tasks = await Task.find({
      project: req.params.projectId,
      isArchived: false
    })
    .populate('assignedTo', 'fullName username email profileImage')
    .populate('createdBy', 'fullName username email profileImage')
    .sort({ position: 1, createdAt: 1 });

    // Group tasks by column and maintain position order
    const tasksByColumn = {
      todo: tasks.filter(task => task.column === 'todo').sort((a, b) => a.position - b.position),
      doing: tasks.filter(task => task.column === 'doing').sort((a, b) => a.position - b.position),
      done: tasks.filter(task => task.column === 'done').sort((a, b) => a.position - b.position)
    };

    res.json({ tasks: tasksByColumn });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new task
router.post('/project/:projectId', checkProjectEditor, [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Task title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('column')
    .isIn(['todo', 'doing', 'done'])
    .withMessage('Column must be todo, doing, or done'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('Assigned users must be an array'),
  body('dueDate')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
      throw new Error('Due date must be a valid date (YYYY-MM-DD) or null to clear');
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { title, description, column, priority = 'low', assignedTo = [], dueDate, tags = [] } = req.body;

    // Check doing column limit if task is being added to doing column
    if (column === 'doing') {
      const doingTasksCount = await Task.countDocuments({
        project: req.params.projectId,
        column: 'doing',
        isArchived: false
      });

      if (doingTasksCount >= req.project.settings.doingColumnLimit) {
        return res.status(400).json({ 
          message: `Doing column limit reached (${req.project.settings.doingColumnLimit} tasks)` 
        });
      }
    }

    // Get the highest position in the target column to append new task at the end
    const maxPositionTask = await Task.findOne({
      project: req.params.projectId,
      column: column,
      isArchived: false
    }).sort({ position: -1 });

    const newPosition = maxPositionTask ? maxPositionTask.position + 1 : 0;

    // Create task
    const task = new Task({
      title,
      description,
      project: req.params.projectId,
      column,
      position: newPosition,
      priority,
      assignedTo,
      createdBy: req.user._id,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags
    });

    await task.save();

    // Populate task
    await task.populate([
      { path: 'assignedTo', select: 'fullName username email profileImage' },
      { path: 'createdBy', select: 'fullName username email profileImage' }
    ]);

    // Create notifications for assigned users
    try {
      for (const userId of assignedTo) {
        if (userId.toString() !== req.user._id.toString()) {
          await Notification.create({
            user: userId,
            type: 'task_assigned',
            title: 'Task Assigned',
            message: `You have been assigned to task "${title}" in "${req.project.name}"`,
            data: { 
              project: req.params.projectId,
              task: task._id
            }
          });
        }
      }
    } catch (notificationError) {
      console.error('Failed to create task assignment notifications:', notificationError);
      // Don't fail the task creation if notifications fail
    }

    // Create notification for project members only if task has high priority
    if (priority === 'high') {
      try {
        const memberIds = req.project.members
          .filter(member => member.user.toString() !== req.user._id.toString())
          .map(member => member.user);

        for (const memberId of memberIds) {
          await Notification.create({
            user: memberId,
            type: 'high_priority_task_created',
            title: 'High Priority Task Created',
            message: `A high priority task "${title}" has been created in "${req.project.name}"`,
            data: { 
              project: req.params.projectId,
              task: task._id
            }
          });
        }
      } catch (notificationError) {
        console.error('Failed to create high priority task notifications:', notificationError);
        // Don't fail the task creation if notifications fail
      }
    }

    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Move/reorder task (for drag and drop)
router.put('/:taskId/move', checkTaskEditor, [
  body('column')
    .isIn(['todo', 'doing', 'done'])
    .withMessage('Column must be todo, doing, or done'),
  body('position')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Position must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    // Task and project are already available from middleware
    const task = req.task;
    const project = req.project;
    const { column, position = 0 } = req.body;

    const oldColumn = task.column;

    // Check doing column limit if moving to doing column
    if (column === 'doing' && oldColumn !== 'doing') {
      const doingTasksCount = await Task.countDocuments({
        project: task.project,
        column: 'doing',
        isArchived: false,
        _id: { $ne: task._id }
      });

      if (doingTasksCount >= project.settings.doingColumnLimit) {
        return res.status(400).json({ 
          message: `Doing column limit reached (${project.settings.doingColumnLimit} tasks)` 
        });
      }
    }

    // Handle position updates for reordering
    if (position !== undefined) {
      // Get all tasks in the target column
      const tasksInColumn = await Task.find({
        project: task.project,
        column: column,
        isArchived: false,
        _id: { $ne: task._id }
      }).sort({ position: 1 });

      // Update positions of tasks that need to be shifted
      const bulkOps = [];
      
      // Shift tasks down to make room at the new position
      tasksInColumn.forEach((t, index) => {
        if (index >= position) {
          bulkOps.push({
            updateOne: {
              filter: { _id: t._id },
              update: { position: index + 1 }
            }
          });
        }
      });

      if (bulkOps.length > 0) {
        await Task.bulkWrite(bulkOps);
      }
    }

    // Update task column and position
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.taskId,
      { 
        column,
        position: position !== undefined ? position : 0
      },
      { new: true, runValidators: true }
    )
    .populate('assignedTo', 'fullName username email profileImage')
    .populate('createdBy', 'fullName username email profileImage');

    // No notifications for task movement

    res.json({
      message: 'Task moved successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Move task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reorder tasks within the same column
router.put('/:taskId/reorder', checkTaskEditor, [
  body('startIndex')
    .isInt({ min: 0 })
    .withMessage('Start index must be a non-negative integer'),
  body('finishIndex')
    .isInt({ min: 0 })
    .withMessage('Finish index must be a non-negative integer'),
  body('column')
    .isIn(['todo', 'doing', 'done'])
    .withMessage('Column must be todo, doing, or done')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { startIndex, finishIndex, column } = req.body;
    const task = req.task;

    // Get all tasks in the column ordered by position
    const tasksInColumn = await Task.find({
      project: task.project,
      column: column,
      isArchived: false
    }).sort({ position: 1 });

    // Create a copy of the array and perform reorder
    const reorderedTasks = [...tasksInColumn];
    const [movedTask] = reorderedTasks.splice(startIndex, 1);
    reorderedTasks.splice(finishIndex, 0, movedTask);

    // Update positions for all affected tasks
    const bulkOps = reorderedTasks.map((t, index) => ({
      updateOne: {
        filter: { _id: t._id },
        update: { position: index }
      }
    }));

    await Task.bulkWrite(bulkOps);

    // Get updated task with populated fields
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'fullName username email profileImage')
      .populate('createdBy', 'fullName username email profileImage');

    res.json({
      message: 'Task reordered successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Reorder task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update task
router.put('/:taskId', checkTaskEditor, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Task title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('column')
    .optional()
    .isIn(['todo', 'doing', 'done'])
    .withMessage('Column must be todo, doing, or done'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('Assigned users must be an array'),
  body('dueDate')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
      throw new Error('Due date must be a valid date (YYYY-MM-DD) or null to clear');
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    // Task and project are already available from middleware
    const task = req.task;
    const project = req.project;

    const { title, description, column, priority, assignedTo, dueDate, tags } = req.body;
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (tags !== undefined) updateData.tags = tags;

    // Handle column change with doing column limit check
    if (column !== undefined && column !== task.column) {
      if (column === 'doing') {
        const doingTasksCount = await Task.countDocuments({
          project: task.project,
          column: 'doing',
          isArchived: false,
          _id: { $ne: task._id }
        });

        if (doingTasksCount >= project.settings.doingColumnLimit) {
          return res.status(400).json({ 
            message: `Doing column limit reached (${project.settings.doingColumnLimit} tasks)` 
          });
        }
      }
      updateData.column = column;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.taskId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('assignedTo', 'fullName username email profileImage')
    .populate('createdBy', 'fullName username email profileImage');

    // Create notification only if priority was changed to high
    if (priority === 'high' && task.priority !== 'high') {
      try {
        const memberIds = project.members
          .filter(member => member.user.toString() !== req.user._id.toString())
          .map(member => member.user);

        for (const memberId of memberIds) {
          await Notification.create({
            user: memberId,
            type: 'high_priority_task_updated',
            title: 'Task Priority Changed to High',
            message: `Task "${updatedTask.title}" has been marked as high priority in "${project.name}"`,
            data: { 
              project: task.project,
              task: task._id
            }
          });
        }
      } catch (notificationError) {
        console.error('Failed to create high priority task update notifications:', notificationError);
        // Don't fail the task update if notifications fail
      }
    }

    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment to task
router.post('/:taskId/comments', checkTaskViewer, [
  body('content')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { content } = req.body;

    // Task and project are already available from middleware
    const task = req.task;

    // Add comment
    task.comments.push({
      user: req.user._id,
      content
    });

    await task.save();

    // Populate the updated task with all necessary fields
    await task.populate([
      { path: 'assignedTo', select: 'fullName username email profileImage' },
      { path: 'createdBy', select: 'fullName username email profileImage' },
      { path: 'comments.user', select: 'fullName username email profileImage' }
    ]);

    res.status(201).json({
      message: 'Comment added successfully',
      task: task
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete task (editors and admins)
router.delete('/:taskId', checkTaskEditor, async (req, res) => {
  try {
    // Task and project are already available from middleware
    const task = req.task;
    
    // Only admins can delete tasks
    if (req.memberRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only admins can delete tasks.' });
    }

    await Task.findByIdAndDelete(req.params.taskId);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Archive task
router.put('/:taskId/archive', checkTaskEditor, async (req, res) => {
  try {
    // Task and project are already available from middleware
    const task = req.task;

    task.isArchived = true;
    await task.save();

    res.json({ message: 'Task archived successfully' });
  } catch (error) {
    console.error('Archive task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
