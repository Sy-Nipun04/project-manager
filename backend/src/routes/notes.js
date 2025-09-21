import express from 'express';
import { body, validationResult } from 'express-validator';
import Note from '../models/Note.js';
import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import { checkProjectAccess, checkProjectEditor } from '../middleware/auth.js';

const router = express.Router();

// Get notes for a project
router.get('/project/:projectId', checkProjectAccess('viewer'), async (req, res) => {
  try {
    const { archived = false } = req.query;
    
    const notes = await Note.find({
      project: req.params.projectId,
      isArchived: archived === 'true'
    })
    .populate('createdBy', 'fullName username email profileImage')
    .populate('taggedUsers', 'fullName username email profileImage')
    .populate('referencedTasks', 'title')
    .sort({ isPinned: -1, createdAt: -1 });

    res.json({ notes });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new note
router.post('/project/:projectId', checkProjectEditor, [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Note title must be between 1 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Note content is required'),
  body('type')
    .isIn(['notice', 'issue', 'reminder', 'important', 'other'])
    .withMessage('Note type must be notice, issue, reminder, important, or other'),
  body('taggedUsers')
    .optional()
    .isArray()
    .withMessage('Tagged users must be an array'),
  body('referencedTasks')
    .optional()
    .isArray()
    .withMessage('Referenced tasks must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { title, content, type, taggedUsers = [], referencedTasks = [] } = req.body;

    // Create note
    const note = new Note({
      title,
      content,
      project: req.params.projectId,
      type,
      createdBy: req.user._id,
      taggedUsers,
      referencedTasks
    });

    await note.save();

    // Populate note
    await note.populate([
      { path: 'createdBy', select: 'fullName username email profileImage' },
      { path: 'taggedUsers', select: 'fullName username email profileImage' },
      { path: 'referencedTasks', select: 'title' }
    ]);

    // Create notifications for tagged users
    for (const userId of taggedUsers) {
      if (userId.toString() !== req.user._id.toString()) {
        await Notification.create({
          user: userId,
          type: 'note_tagged',
          title: 'Tagged in Note',
          message: `You have been tagged in a note "${title}" in "${req.project.name}"`,
          data: { 
            project: req.params.projectId,
            note: note._id
          }
        });
      }
    }

    // Create notification for project members about new note
    const memberIds = req.project.members
      .filter(member => member.user.toString() !== req.user._id.toString())
      .map(member => member.user);

    for (const memberId of memberIds) {
      await Notification.create({
        user: memberId,
        type: 'note_created',
        title: 'New Note Created',
        message: `A new note "${title}" has been created in "${req.project.name}"`,
        data: { 
          project: req.params.projectId,
          note: note._id
        }
      });
    }

    res.status(201).json({
      message: 'Note created successfully',
      note
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update note
router.put('/:noteId', checkProjectEditor, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Note title must be between 1 and 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Note content is required'),
  body('type')
    .optional()
    .isIn(['notice', 'issue', 'reminder', 'important', 'other'])
    .withMessage('Note type must be notice, issue, reminder, important, or other'),
  body('taggedUsers')
    .optional()
    .isArray()
    .withMessage('Tagged users must be an array'),
  body('referencedTasks')
    .optional()
    .isArray()
    .withMessage('Referenced tasks must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if user has access to this note's project
    const project = await Project.findById(note.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, content, type, taggedUsers, referencedTasks } = req.body;
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (taggedUsers !== undefined) updateData.taggedUsers = taggedUsers;
    if (referencedTasks !== undefined) updateData.referencedTasks = referencedTasks;

    const updatedNote = await Note.findByIdAndUpdate(
      req.params.noteId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('createdBy', 'fullName username email profileImage')
    .populate('taggedUsers', 'fullName username email profileImage')
    .populate('referencedTasks', 'title');

    res.json({
      message: 'Note updated successfully',
      note: updatedNote
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle note pin status
router.put('/:noteId/pin', checkProjectEditor, async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if user has access to this note's project
    const project = await Project.findById(note.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

    note.isPinned = !note.isPinned;
    await note.save();

    res.json({
      message: `Note ${note.isPinned ? 'pinned' : 'unpinned'} successfully`,
      note
    });
  } catch (error) {
    console.error('Toggle note pin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Archive note
router.put('/:noteId/archive', checkProjectEditor, async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if user has access to this note's project
    const project = await Project.findById(note.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

    note.isArchived = true;
    note.isPinned = false; // Unpin when archiving
    await note.save();

    res.json({ message: 'Note archived successfully' });
  } catch (error) {
    console.error('Archive note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Restore archived note
router.put('/:noteId/restore', checkProjectEditor, async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if user has access to this note's project
    const project = await Project.findById(note.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

    note.isArchived = false;
    await note.save();

    res.json({ message: 'Note restored successfully' });
  } catch (error) {
    console.error('Restore note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete note
router.delete('/:noteId', checkProjectEditor, async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if user has access to this note's project
    const project = await Project.findById(note.project);
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Note.findByIdAndDelete(req.params.noteId);

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
