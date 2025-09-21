import express from 'express';
import { body, validationResult } from 'express-validator';
import Project from '../models/Project.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { checkProjectAccess, checkProjectAdmin, checkProjectEditor } from '../middleware/auth.js';

const router = express.Router();

// Get user's projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { creator: req.user._id },
        { 'members.user': req.user._id }
      ],
      'settings.isArchived': false
    })
    .populate('creator', 'fullName username email profileImage')
    .populate('members.user', 'fullName username email profileImage')
    .sort({ updatedAt: -1 });

    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single project
router.get('/:projectId', checkProjectAccess('viewer'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('creator', 'fullName username email profileImage')
      .populate('members.user', 'fullName username email profileImage')
      .populate('invitations.user', 'fullName username email profileImage')
      .populate('invitations.invitedBy', 'fullName username email profileImage');

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new project
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Project name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, description, memberEmails } = req.body;

    // Create project
    const project = new Project({
      name,
      description,
      creator: req.user._id
    });

    await project.save();

    // Add members if provided
    if (memberEmails && memberEmails.length > 0) {
      for (const email of memberEmails) {
        const user = await User.findOne({ email });
        if (user && user._id.toString() !== req.user._id.toString()) {
          // Add invitation
          project.invitations.push({
            user: user._id,
            invitedBy: req.user._id,
            role: 'viewer'
          });

          // Create notification
          await Notification.create({
            user: user._id,
            type: 'project_invitation',
            title: 'Project Invitation',
            message: `You've been invited to join the project "${name}"`,
            data: { 
              project: project._id,
              invitation: project._id
            }
          });
        }
      }
      await project.save();
    }

    // Populate and return project
    await project.populate([
      { path: 'creator', select: 'fullName username email profileImage' },
      { path: 'members.user', select: 'fullName username email profileImage' }
    ]);

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project settings (admin only)
router.put('/:projectId/settings', checkProjectAdmin, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Project name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('doingColumnLimit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Doing column limit must be between 1 and 20')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, description, doingColumnLimit } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (doingColumnLimit !== undefined) {
      updateData['settings.doingColumnLimit'] = doingColumnLimit;
    }

    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('creator', 'fullName username email profileImage')
    .populate('members.user', 'fullName username email profileImage');

    res.json({
      message: 'Project settings updated successfully',
      project
    });
  } catch (error) {
    console.error('Update project settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project markdown content
router.put('/:projectId/markdown', checkProjectEditor, [
  body('content')
    .notEmpty()
    .withMessage('Markdown content is required')
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

    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { markdownContent: content },
      { new: true }
    );

    res.json({
      message: 'Markdown content updated successfully',
      project
    });
  } catch (error) {
    console.error('Update markdown error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Invite user to project
router.post('/:projectId/invite', checkProjectAdmin, [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('role')
    .optional()
    .isIn(['viewer', 'editor', 'admin'])
    .withMessage('Role must be viewer, editor, or admin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, role = 'viewer' } = req.body;
    const projectId = req.params.projectId;

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email }, { username: email }]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a member
    const existingMember = req.project.members.find(
      member => member.user.toString() === user._id.toString()
    );

    if (existingMember) {
      return res.status(400).json({ message: 'User is already a member of this project' });
    }

    // Check if invitation already exists
    const existingInvitation = req.project.invitations.find(
      inv => inv.user.toString() === user._id.toString() && inv.status === 'pending'
    );

    if (existingInvitation) {
      return res.status(400).json({ message: 'Invitation already sent to this user' });
    }

    // Add invitation
    req.project.invitations.push({
      user: user._id,
      invitedBy: req.user._id,
      role
    });

    await req.project.save();

    // Create notification
    await Notification.create({
      user: user._id,
      type: 'project_invitation',
      title: 'Project Invitation',
      message: `You've been invited to join the project "${req.project.name}" as ${role}`,
      data: { 
        project: projectId,
        invitation: projectId
      }
    });

    res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Respond to project invitation
router.put('/:projectId/invitation/:invitationId', [
  body('action')
    .isIn(['accept', 'decline'])
    .withMessage('Action must be either accept or decline')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { projectId, invitationId } = req.params;
    const { action } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const invitation = project.invitations.id(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (invitation.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation already processed' });
    }

    // Update invitation status
    invitation.status = action === 'accept' ? 'accepted' : 'declined';

    if (action === 'accept') {
      // Add user to project members
      project.members.push({
        user: req.user._id,
        role: invitation.role
      });

      // Create notification for project members
      const memberIds = project.members
        .filter(member => member.user.toString() !== req.user._id.toString())
        .map(member => member.user);

      for (const memberId of memberIds) {
        await Notification.create({
          user: memberId,
          type: 'member_added',
          title: 'New Team Member',
          message: `${req.user.fullName} joined the project "${project.name}"`,
          data: { 
            project: project._id,
            user: req.user._id
          }
        });
      }
    }

    await project.save();

    res.json({ 
      message: `Invitation ${action}ed successfully` 
    });
  } catch (error) {
    console.error('Respond to invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update member role
router.put('/:projectId/members/:memberId/role', checkProjectAdmin, [
  body('role')
    .isIn(['viewer', 'editor', 'admin'])
    .withMessage('Role must be viewer, editor, or admin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { memberId } = req.params;
    const { role } = req.body;

    const member = req.project.members.id(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const oldRole = member.role;
    member.role = role;
    await req.project.save();

    // Create notification for the member
    await Notification.create({
      user: member.user,
      type: 'role_changed',
      title: 'Role Updated',
      message: `Your role in "${req.project.name}" has been changed from ${oldRole} to ${role}`,
      data: { project: req.project._id }
    });

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove member from project
router.delete('/:projectId/members/:memberId', checkProjectAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = req.project.members.id(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Cannot remove the creator
    if (member.user.toString() === req.project.creator.toString()) {
      return res.status(400).json({ message: 'Cannot remove project creator' });
    }

    // Create notification for the removed member
    await Notification.create({
      user: member.user,
      type: 'member_removed',
      title: 'Removed from Project',
      message: `You have been removed from the project "${req.project.name}"`,
      data: { project: req.project._id }
    });

    // Remove member
    req.project.members.pull(memberId);
    await req.project.save();

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete project
router.delete('/:projectId', checkProjectAdmin, [
  body('projectName')
    .notEmpty()
    .withMessage('Project name is required for confirmation'),
  body('password')
    .notEmpty()
    .withMessage('Password is required for confirmation')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { projectName, password } = req.body;

    // Verify project name
    if (projectName !== req.project.name) {
      return res.status(400).json({ message: 'Project name does not match' });
    }

    // Verify password
    const user = await User.findById(req.user._id);
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Delete project (this will cascade delete related tasks and notes)
    await Project.findByIdAndDelete(req.params.projectId);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
