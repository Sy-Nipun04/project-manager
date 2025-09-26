import express from 'express';
import { body, validationResult } from 'express-validator';
import Project from '../models/Project.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Note from '../models/Note.js';
import Task from '../models/Task.js';
import Bookmark from '../models/Bookmark.js';
import Activity from '../models/Activity.js';
import { checkProjectAccess, checkProjectAdmin, checkProjectEditor } from '../middleware/auth.js';

const router = express.Router();

// Helper function to add bookmark status to notes for a specific user
const addBookmarkStatusToNotes = async (notes, userId) => {
  const noteIds = notes.map(note => note._id);
  const userBookmarks = await Bookmark.find({
    user: userId,
    note: { $in: noteIds }
  });
  
  const bookmarkedNoteIds = new Set(userBookmarks.map(bookmark => bookmark.note.toString()));
  
  return notes.map(note => ({
    ...note.toObject(),
    author: note.createdBy, // Map createdBy to author for frontend compatibility
    taggedMembers: note.taggedUsers, // Map taggedUsers to taggedMembers for frontend compatibility
    isBookmarked: bookmarkedNoteIds.has(note._id.toString())
  }));
};

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

// Get user's archived projects
router.get('/archived', async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { creator: req.user._id },
        { 'members.user': req.user._id }
      ],
      'settings.isArchived': true
    })
    .populate('creator', 'fullName username email profileImage')
    .populate('members.user', 'fullName username email profileImage')
    .populate('settings.archivedBy', 'fullName username email profileImage')
    .sort({ 'settings.archivedAt': -1 });

    res.json({ projects });
  } catch (error) {
    console.error('Get archived projects error:', error);
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
        }
      }
      
      // Save to get invitation IDs
      await project.save();
      
      // Create notifications with correct invitation IDs
      for (let i = 0; i < memberEmails.length; i++) {
        const email = memberEmails[i];
        const user = await User.findOne({ email });
        if (user && user._id.toString() !== req.user._id.toString()) {
          const invitation = project.invitations.find(inv => 
            inv.user.toString() === user._id.toString()
          );
          
          if (invitation) {
            await Notification.create({
              user: user._id,
              type: 'project_invitation',
              title: 'Project Invitation',
              message: `You've been invited to join the project "${name}"`,
              data: { 
                project: project._id,
                invitation: invitation._id.toString()  // Convert to string
              }
            });
          }
        }
      }
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

    const { name, description, doingColumnLimit, notifyNameChange } = req.body;
    const updateData = {};
    const oldProjectName = req.project.name;

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

    // Send notifications to all members if name changed
    if (notifyNameChange && name && name !== oldProjectName) {
      console.log('Sending name change notifications to project members');
      console.log(`Old name: "${oldProjectName}", New name: "${name}"`);
      
      const memberIds = project.members
        .filter(member => member.user._id.toString() !== req.user._id.toString())
        .map(member => member.user._id);

      console.log(`Found ${memberIds.length} members to notify:`, memberIds);

      for (const memberId of memberIds) {
        try {
          const notification = await Notification.create({
            user: memberId,
            type: 'project_name_changed',
            title: 'Project Name Updated',
            message: `The project "${oldProjectName}" has been renamed to "${name}" by ${req.user.fullName}`,
            data: { 
              project: project._id,
              oldName: oldProjectName,
              newName: name,
              changedBy: req.user._id
            }
          });
          console.log(`Notification created successfully for user ${memberId}:`, notification._id);
        } catch (notificationError) {
          console.error(`Failed to create notification for user ${memberId}:`, notificationError);
        }
      }
    }

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
router.put('/:projectId/markdown', checkProjectAdmin, [
  body('content')
    .optional()
    .isString()
    .withMessage('Markdown content must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { content = '' } = req.body;

    console.log('Updating project markdown:', {
      projectId: req.params.projectId,
      contentLength: content.length,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
    });

    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { markdownContent: content },
      { new: true }
    )
    .populate('creator', 'fullName username email profileImage')
    .populate('members.user', 'fullName username email profileImage');

    console.log('Updated project markdown saved:', {
      projectId: project._id,
      markdownContentLength: project.markdownContent?.length || 0
    });

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

    // Check if user is trying to invite themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot invite yourself to a project' });
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

    // Get the invitation ID (last added invitation)
    const invitationId = req.project.invitations[req.project.invitations.length - 1]._id;

    // Create notification
    await Notification.create({
      user: user._id,
      type: 'project_invitation',
      title: 'Project Invitation',
      message: `You've been invited to join the project "${req.project.name}" as ${role}`,
      data: { 
        project: projectId,
        invitation: invitationId.toString()  // Convert to string
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

    if (invitation.status === 'invalid') {
      return res.status(400).json({ message: 'This invitation is no longer valid. The project may have been archived or deleted.' });
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

      // Notify the inviter about acceptance
      await Notification.create({
        user: invitation.invitedBy,
        type: 'invitation_accepted',
        title: 'Invitation Accepted',
        message: `${req.user.fullName} accepted your invitation to join "${project.name}"`,
        data: { 
          project: project._id,
          user: req.user._id
        }
      });
    } else {
      // Notify the inviter about decline
      await Notification.create({
        user: invitation.invitedBy,
        type: 'invitation_declined',
        title: 'Invitation Declined',
        message: `${req.user.fullName} declined your invitation to join "${project.name}"`,
        data: { 
          project: project._id,
          user: req.user._id
        }
      });
    }

    await project.save();

    // Update the original notification to show it's been processed
    await Notification.findOneAndUpdate(
      { 
        user: req.user._id,
        type: 'project_invitation',
        'data.project': projectId,
        'data.invitation': invitationId 
      },
      { 
        isRead: true,
        readAt: new Date(),
        'data.actionTaken': action === 'accept' ? 'accepted' : 'declined',
        message: `You ${action === 'accept' ? 'accepted' : 'declined'} the invitation to join "${project.name}"`
      }
    );

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
router.delete('/:projectId/members/:memberId', checkProjectAccess('viewer'), async (req, res) => {
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

    // Check permissions: users can remove themselves, or admins can remove others
    const memberUserId = member.user._id ? member.user._id.toString() : member.user.toString();
    const isRemovingSelf = memberUserId === req.user._id.toString();
    const userMember = req.project.members.find(m => {
      const userIdToCompare = m.user._id ? m.user._id.toString() : m.user.toString();
      return userIdToCompare === req.user._id.toString();
    });
    const isAdmin = userMember?.role === 'admin';



    if (!isRemovingSelf && !isAdmin) {
      return res.status(403).json({ message: 'You can only remove yourself from the project, or be an admin to remove others' });
    }

    // Populate member user details for notifications
    await req.project.populate('members.user', 'fullName username email');
    const memberUser = req.project.members.id(memberId).user;
    const isCurrentUser = isRemovingSelf;

    // Create notification for the removed member
    await Notification.create({
      user: member.user,
      type: 'member_removed',
      title: isCurrentUser ? 'Left Project' : 'Removed from Project',
      message: isCurrentUser 
        ? `You have left the project "${req.project.name}"` 
        : `You have been removed from the project "${req.project.name}" by ${req.user.fullName}`,
      data: { project: req.project._id }
    });

    // Create notifications for all other members
    const otherMemberIds = req.project.members
      .filter(m => m._id.toString() !== memberId && m.user._id.toString() !== req.user._id.toString())
      .map(m => m.user._id);

    for (const otherMemberId of otherMemberIds) {
      await Notification.create({
        user: otherMemberId,
        type: 'member_removed',
        title: 'Team Member Update',
        message: isCurrentUser 
          ? `${memberUser.fullName} has left the project "${req.project.name}"` 
          : `${memberUser.fullName} has been removed from the project "${req.project.name}" by ${req.user.fullName}`,
        data: { 
          project: req.project._id,
          user: member.user,
          removedBy: req.user._id
        }
      });
    }

    // Remove member
    req.project.members.pull(memberId);
    await req.project.save();

    const successMessage = isRemovingSelf 
      ? `You have successfully left the project "${req.project.name}"`
      : 'Member removed successfully';

    res.json({ message: successMessage });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Archive project
router.post('/:projectId/archive', checkProjectAdmin, async (req, res) => {
  try {
    const { notifyMembers = true } = req.body;
    
    // Check if project is already archived
    if (req.project.settings.isArchived) {
      return res.status(400).json({ message: 'Project is already archived' });
    }

    // Update project to archived status
    req.project.settings.isArchived = true;
    req.project.settings.archivedAt = new Date();
    req.project.settings.archivedBy = req.user._id;
    
    // Invalidate pending invitations and update existing notifications
    const pendingInvitations = req.project.invitations.filter(inv => inv.status === 'pending');
    for (const invitation of pendingInvitations) {
      invitation.status = 'invalid';
      
      // Update the original project_invitation notification to show it's invalid
      await Notification.findOneAndUpdate(
        { 
          user: invitation.user,
          type: 'project_invitation',
          'data.project': req.project._id,
          'data.invitation': invitation._id.toString()
        },
        { 
          'data.isInvalid': true
        }
      );
    }
    
    await req.project.save();

    // Send notifications to all members if requested
    if (notifyMembers) {
      const memberIds = req.project.members
        .filter(member => member.user.toString() !== req.user._id.toString())
        .map(member => member.user);

      for (const memberId of memberIds) {
        await Notification.create({
          user: memberId,
          type: 'project_archived',
          title: 'Project Archived',
          message: `The project "${req.project.name}" has been archived by ${req.user.fullName}`,
          data: { 
            project: req.project._id,
            archivedBy: req.user._id,
            action: 'archived'
          }
        });
      }
    }

    res.json({ 
      message: 'Project archived successfully',
      project: req.project 
    });
  } catch (error) {
    console.error('Archive project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unarchive project
router.post('/:projectId/unarchive', checkProjectAdmin, async (req, res) => {
  try {
    const { notifyMembers = true } = req.body;
    
    // Check if project is actually archived
    if (!req.project.settings.isArchived) {
      return res.status(400).json({ message: 'Project is not archived' });
    }

    // Update project to unarchived status
    req.project.settings.isArchived = false;
    req.project.settings.archivedAt = null;
    req.project.settings.archivedBy = null;
    
    await req.project.save();

    // Send notifications to all members if requested
    if (notifyMembers) {
      const memberIds = req.project.members
        .filter(member => member.user.toString() !== req.user._id.toString())
        .map(member => member.user);

      for (const memberId of memberIds) {
        await Notification.create({
          user: memberId,
          type: 'project_unarchived',
          title: 'Project Unarchived',
          message: `The project "${req.project.name}" has been unarchived by ${req.user.fullName}`,
          data: { 
            project: req.project._id,
            unarchivedBy: req.user._id,
            action: 'unarchived'
          }
        });
      }
    }

    res.json({ 
      message: 'Project unarchived successfully',
      project: req.project 
    });
  } catch (error) {
    console.error('Unarchive project error:', error);
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

    const { projectName, password, notifyMembers = true } = req.body;

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

    // Invalidate pending invitations and update existing notifications
    const pendingInvitations = req.project.invitations.filter(inv => inv.status === 'pending');
    for (const invitation of pendingInvitations) {
      invitation.status = 'invalid';
      
      // Update the original project_invitation notification to show it's invalid
      await Notification.findOneAndUpdate(
        { 
          user: invitation.user,
          type: 'project_invitation',
          'data.project': req.project._id,
          'data.invitation': invitation._id.toString()
        },
        { 
          'data.isInvalid': true
        }
      );
    }

    // Send notifications to all members before deletion if requested
    if (notifyMembers) {
      const memberIds = req.project.members
        .filter(member => member.user.toString() !== req.user._id.toString())
        .map(member => member.user);

      for (const memberId of memberIds) {
        await Notification.create({
          user: memberId,
          type: 'project_deleted',
          title: 'Project Deleted',
          message: `The project "${req.project.name}" has been deleted by ${req.user.fullName}`,
          data: { 
            projectName: req.project.name,
            deletedBy: req.user._id,
            action: 'deleted'
          }
        });
      }
    }

    // Delete project (this will cascade delete related tasks and notes)
    await Project.findByIdAndDelete(req.params.projectId);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ NOTES ROUTES ============

// Get notes for a project
router.get('/:projectId/notes', checkProjectAccess('viewer'), async (req, res) => {
  try {
    const notes = await Note.find({
      project: req.params.projectId
    })
    .populate('createdBy', 'fullName username email')
    .populate('taggedUsers', 'fullName username email')
    .populate('referencedTasks', 'title status')
    .sort({ createdAt: -1, updatedAt: -1 }); // Sort by most recent first

    // Add user-specific bookmark status
    const notesFormatted = await addBookmarkStatusToNotes(notes, req.user._id);

    // Sort notes with important notes at the top, then by latest update time
    const sortedNotes = notesFormatted.sort((a, b) => {
      // If one is important and other is not, important comes first
      if (a.type === 'important' && b.type !== 'important') return -1;
      if (b.type === 'important' && a.type !== 'important') return 1;
      
      // If both are important or both are not important, sort by update time (latest first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    res.json({ notes: sortedNotes });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new note
router.post('/:projectId/notes', checkProjectAccess('editor'), [
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
  body('taggedMembers')
    .optional()
    .isArray()
    .withMessage('Tagged members must be an array'),
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

    const { title, content, type, taggedMembers = [], referencedTasks = [] } = req.body;

    // Filter out the current user from tagged members (user shouldn't tag themselves)
    const filteredTaggedMembers = taggedMembers.filter(
      memberId => memberId.toString() !== req.user._id.toString()
    );

    // Create note
    const note = new Note({
      title,
      content,
      project: req.params.projectId,
      type,
      createdBy: req.user._id,
      taggedUsers: filteredTaggedMembers,
      referencedTasks
    });

    await note.save();

    // Populate note
    await note.populate([
      { path: 'createdBy', select: 'fullName username email' },
      { path: 'taggedUsers', select: 'fullName username email' },
      { path: 'referencedTasks', select: 'title status' }
    ]);

    // Create notifications for tagged members
    for (const memberId of filteredTaggedMembers) {
      await Notification.create({
        user: memberId,
        type: 'note_tagged',
        title: 'Tagged in Note',
        message: `You have been tagged by ${req.user.fullName} in a note "${title}" in project "${req.project.name}"`,
        data: { 
          project: req.params.projectId,
          note: note._id,
          creator: req.user._id
        }
      });
    }

    // Create notifications for all project members if note is important or reminder
    if (type === 'important' || type === 'reminder') {
      const memberIds = req.project.members
        .filter(member => member.user.toString() !== req.user._id.toString())
        .map(member => member.user);

      for (const memberId of memberIds) {
        await Notification.create({
          user: memberId,
          type: 'note_created',
          title: type === 'important' ? 'Important Note Created' : 'Reminder Note Created',
          message: `A(n) ${type} note "${title}" has been created by ${req.user.fullName} in project "${req.project.name}"`,
          data: { 
            project: req.params.projectId,
            note: note._id
          }
        });
      }
    }

    // Create activity record
    await Activity.create({
      project: req.params.projectId,
      user: req.user._id,
      type: 'note_created',
      action: `Created note: ${title}`,
      targetId: note._id,
      targetTitle: title
    });

    // Format note for frontend compatibility with user-specific bookmark status
    const [noteFormatted] = await addBookmarkStatusToNotes([note], req.user._id);

    res.status(201).json({
      message: 'Note created successfully',
      note: noteFormatted
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update note
router.put('/:projectId/notes/:noteId', checkProjectAccess('viewer'), [
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
  body('taggedMembers')
    .optional()
    .isArray()
    .withMessage('Tagged members must be an array'),
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

    // Check if user can edit this note (only author or admins/editors can edit)
    const userRole = req.project.members.find(m => m.user.toString() === req.user._id.toString())?.role;
    const canEdit = note.createdBy.toString() === req.user._id.toString() || 
                   ['admin', 'editor'].includes(userRole);

    if (!canEdit) {
      return res.status(403).json({ message: 'You can only edit your own notes' });
    }

    const { title, content, type, taggedMembers, referencedTasks } = req.body;
    
    // Filter out the current user from tagged members (user shouldn't tag themselves)
    const filteredTaggedMembers = taggedMembers ? taggedMembers.filter(
      memberId => memberId.toString() !== req.user._id.toString()
    ) : undefined;

    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (taggedMembers !== undefined) updateData.taggedUsers = filteredTaggedMembers;
    if (referencedTasks !== undefined) updateData.referencedTasks = referencedTasks;

    // Check if note is being changed to important
    const wasImportant = note.type === 'important';
    const isNowImportant = type === 'important';

    const updatedNote = await Note.findByIdAndUpdate(
      req.params.noteId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('createdBy', 'fullName username email')
    .populate('taggedUsers', 'fullName username email')
    .populate('referencedTasks', 'title status');

    // Check if note is being changed to reminder
    const wasReminder = note.type === 'reminder';
    const isNowReminder = type === 'reminder';

    // Create notifications if changed to important or reminder
    if ((!wasImportant && isNowImportant) || (!wasReminder && isNowReminder)) {
      const memberIds = req.project.members
        .filter(member => member.user.toString() !== req.user._id.toString())
        .map(member => member.user);

      for (const memberId of memberIds) {
        await Notification.create({
          user: memberId,
          type: 'note_created',
          title: isNowImportant ? 'Note Marked Important' : 'Note Marked as Reminder',
          message: `A note "${updatedNote.title}" has been marked as ${isNowImportant ? 'important' : 'a reminder'} by ${req.user.fullName} in project "${req.project.name}"`,
          data: { 
            project: req.params.projectId,
            note: updatedNote._id
          }
        });
      }
    }

    // Create notifications for newly tagged members
    if (filteredTaggedMembers) {
      for (const memberId of filteredTaggedMembers) {
        if (!note.taggedUsers.includes(memberId)) {
          await Notification.create({
            user: memberId,
            type: 'note_tagged',
            title: 'Tagged in Note',
            message: `You have been tagged by ${req.user.fullName} in a note "${updatedNote.title}" in project "${req.project.name}"`,
            data: { 
              project: req.params.projectId,
              note: updatedNote._id,
              creator: req.user._id
            }
          });
        }
      }
    }

    // Create activity record for update
    await Activity.create({
      project: req.params.projectId,
      user: req.user._id,
      type: 'note_updated',
      action: `Updated note: ${updatedNote.title}`,
      targetId: updatedNote._id,
      targetTitle: updatedNote.title
    });

    // Format note for frontend compatibility with user-specific bookmark status
    const [noteFormatted] = await addBookmarkStatusToNotes([updatedNote], req.user._id);

    res.json({
      message: 'Note updated successfully',
      note: noteFormatted
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete note
router.delete('/:projectId/notes/:noteId', checkProjectAccess('viewer'), async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check if user can delete this note (only author or admins/editors can delete)
    const userMember = req.project.members.find(m => {
      const memberId = typeof m.user === 'string' ? m.user : m.user._id || m.user;
      return memberId.toString() === req.user._id.toString();
    });
    
    const userRole = userMember?.role;
    const isAuthor = note.createdBy.toString() === req.user._id.toString();
    const isAdmin = userRole === 'admin';
    
    // Permission logic: Authors can delete their own notes, Admins can delete any notes
    const canDelete = isAuthor || isAdmin;
    
    if (!canDelete) {
      const message = userRole === 'editor' 
        ? 'Editors can only delete their own notes.' 
        : 'You do not have permission to delete this note. Only note authors and admins can delete notes.';
      
      return res.status(403).json({ message });
    }

    // Create activity record before deletion (while we still have note data)
    await Activity.create({
      project: req.params.projectId,
      user: req.user._id,
      type: 'note_deleted',
      action: `Deleted note: ${note.title}`,
      targetId: note._id,
      targetTitle: note.title
    });

    // Delete the note
    await Note.findByIdAndDelete(req.params.noteId);
    
    // Clean up associated bookmarks
    await Bookmark.deleteMany({ note: req.params.noteId });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle bookmark (user-specific bookmarks)
router.post('/:projectId/notes/:noteId/bookmark', checkProjectAccess('viewer'), [
  body('bookmark')
    .isBoolean()
    .withMessage('Bookmark must be a boolean')
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

    const { bookmark } = req.body;
    
    if (bookmark) {
      // Add bookmark (create if doesn't exist)
      await Bookmark.findOneAndUpdate(
        {
          user: req.user._id,
          note: req.params.noteId,
          project: req.params.projectId
        },
        {
          user: req.user._id,
          note: req.params.noteId,
          project: req.params.projectId
        },
        {
          upsert: true,
          new: true
        }
      );
    } else {
      // Remove bookmark
      await Bookmark.findOneAndDelete({
        user: req.user._id,
        note: req.params.noteId
      });
    }

    res.json({ 
      message: bookmark ? 'Note bookmarked' : 'Bookmark removed',
      isBookmarked: bookmark
    });
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bookmarked notes (user-specific bookmarks)
router.get('/:projectId/notes/bookmarks', checkProjectAccess('viewer'), async (req, res) => {
  try {
    // Get user's bookmarks for this project
    const bookmarks = await Bookmark.find({
      user: req.user._id,
      project: req.params.projectId
    }).populate({
      path: 'note',
      populate: [
        { path: 'createdBy', select: 'fullName username email' },
        { path: 'taggedUsers', select: 'fullName username email' },
        { path: 'referencedTasks', select: 'title status' }
      ]
    }).sort({ createdAt: -1 });

    // Format notes for frontend compatibility
    const notesFormatted = bookmarks
      .filter(bookmark => bookmark.note) // Filter out bookmarks where note might be deleted
      .map(bookmark => ({
        ...bookmark.note.toObject(),
        author: bookmark.note.createdBy, // Map createdBy to author for frontend compatibility
        taggedMembers: bookmark.note.taggedUsers, // Map taggedUsers to taggedMembers for frontend compatibility
        isBookmarked: true
      }));

    res.json({ notes: notesFormatted });
  } catch (error) {
    console.error('Get bookmarked notes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notes activity
router.get('/:projectId/notes/activity', checkProjectAccess('viewer'), async (req, res) => {
  try {
    // Keep only the 15 most recent activities, delete older ones
    const allActivities = await Activity.find({
      project: req.params.projectId,
      type: { $in: ['note_created', 'note_updated', 'note_deleted'] }
    })
    .sort({ createdAt: -1 })
    .select('_id');

    // If we have more than 15 activities, delete the older ones
    if (allActivities.length > 15) {
      const activitiesToKeep = allActivities.slice(0, 15);
      const activityIdsToKeep = activitiesToKeep.map(activity => activity._id);
      
      await Activity.deleteMany({
        project: req.params.projectId,
        type: { $in: ['note_created', 'note_updated', 'note_deleted'] },
        _id: { $nin: activityIdsToKeep }
      });
    }

    // Get recent activities for this project related to notes
    const activities = await Activity.find({
      project: req.params.projectId,
      type: { $in: ['note_created', 'note_updated', 'note_deleted'] }
    })
    .populate('user', 'fullName username email')
    .sort({ createdAt: -1 })
    .limit(15);

    res.json({ activities });
  } catch (error) {
    console.error('Get notes activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tasks for referencing
router.get('/:projectId/tasks', checkProjectAccess('viewer'), async (req, res) => {
  try {
    const tasks = await Task.find({
      project: req.params.projectId
    })
    .select('title status')
    .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
