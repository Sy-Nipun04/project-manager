import express from 'express';
import { body, validationResult } from 'express-validator';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import { checkProjectAccess, checkProjectEditor, checkProjectAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get tasks for a project
router.get('/project/:projectId', checkProjectAccess('viewer'), async (req, res) => {
  try {
    const tasks = await Task.find({
      project: req.params.projectId,
      isArchived: false
    })
    .populate('assignedTo', 'fullName username email profileImage')
    .populate('createdBy', 'fullName username email profileImage')
    .sort({ createdAt: -1 });

    // Group tasks by column
    const tasksByColumn = {
      todo: tasks.filter(task => task.column === 'todo'),
      doing: tasks.filter(task => task.column === 'doing'),
      done: tasks.filter(task => task.column === 'done')
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
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('Assigned users must be an array'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { title, description, column, priority = 'medium', assignedTo = [], dueDate, tags = [] } = req.body;

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

    // Create task
    const task = new Task({
      title,
      description,
      project: req.params.projectId,
      column,
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

    // Create notification for project members about new task
    const memberIds = req.project.members
      .filter(member => member.user.toString() !== req.user._id.toString())
      .map(member => member.user);

    for (const memberId of memberIds) {
      await Notification.create({
        user: memberId,
        type: 'task_created',
        title: 'New Task Created',
        message: `A new task "${title}" has been created in "${req.project.name}"`,
        data: { 
          project: req.params.projectId,
          task: task._id
        }
      });
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

// Update task
router.put('/:taskId', checkProjectEditor, [
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
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('Assigned users must be an array'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task's project
    const project = await Project.findById(task.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

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

    // Create notification if task was moved
    if (column !== undefined && column !== task.column) {
      const memberIds = project.members
        .filter(member => member.user.toString() !== req.user._id.toString())
        .map(member => member.user);

      for (const memberId of memberIds) {
        await Notification.create({
          user: memberId,
          type: 'task_moved',
          title: 'Task Moved',
          message: `Task "${updatedTask.title}" has been moved to ${column} in "${project.name}"`,
          data: { 
            project: task.project,
            task: task._id
          }
        });
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
router.post('/:taskId/comments', checkProjectAccess('viewer'), [
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

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task's project
    const project = await Project.findById(task.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add comment
    task.comments.push({
      user: req.user._id,
      content
    });

    await task.save();

    // Populate the new comment
    await task.populate('comments.user', 'fullName username email profileImage');

    const newComment = task.comments[task.comments.length - 1];

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete task (editors and admins)
router.delete('/:taskId', checkProjectEditor, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task's project
    const project = await Project.findById(task.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Task.findByIdAndDelete(req.params.taskId);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Archive task
router.put('/:taskId/archive', checkProjectEditor, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task's project
    const project = await Project.findById(task.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

    task.isArchived = true;
    await task.save();

    res.json({ message: 'Task archived successfully' });
  } catch (error) {
    console.error('Archive task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
