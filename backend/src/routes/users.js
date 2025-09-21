import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { fullName, username } = req.body;
    const updateData = {};

    if (fullName) updateData.fullName = fullName;
    if (username) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: req.user._id } 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateData.username = username;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ 
      message: 'Profile updated successfully', 
      user 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by email or username
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } }, // Exclude current user
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { fullName: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('fullName username email profileImage isOnline lastSeen')
    .limit(10);

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends list
router.get('/friends', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'fullName username email profileImage isOnline lastSeen')
      .select('friends');

    res.json({ friends: user.friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
router.post('/friend-request', [
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { userId } = req.body;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already friends
    const currentUser = await User.findById(req.user._id);
    if (currentUser.friends.includes(userId)) {
      return res.status(400).json({ message: 'Already friends with this user' });
    }

    // Check if friend request already exists
    const existingRequest = targetUser.friendRequests.find(
      req => req.user.toString() === req.user._id.toString() && req.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // Add friend request
    targetUser.friendRequests.push({
      user: req.user._id,
      status: 'pending'
    });
    await targetUser.save();

    // Create notification
    await Notification.create({
      user: userId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${currentUser.fullName} sent you a friend request`,
      data: { user: req.user._id }
    });

    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Respond to friend request
router.put('/friend-request/:requestId', [
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

    const { requestId } = req.params;
    const { action } = req.body;

    const user = await User.findById(req.user._id);
    const friendRequest = user.friendRequests.id(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Friend request already processed' });
    }

    // Update friend request status
    friendRequest.status = action === 'accept' ? 'accepted' : 'declined';
    await user.save();

    if (action === 'accept') {
      // Add to friends list for both users
      user.friends.push(friendRequest.user);
      await user.save();

      const requester = await User.findById(friendRequest.user);
      requester.friends.push(req.user._id);
      await requester.save();

      // Create notification for requester
      await Notification.create({
        user: friendRequest.user,
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${user.fullName} accepted your friend request`,
        data: { user: req.user._id }
      });
    }

    res.json({ 
      message: `Friend request ${action}ed successfully` 
    });
  } catch (error) {
    console.error('Respond to friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend
router.delete('/friends/:friendId', async (req, res) => {
  try {
    const { friendId } = req.params;

    // Remove from current user's friends list
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friends: friendId }
    });

    // Remove from friend's friends list
    await User.findByIdAndUpdate(friendId, {
      $pull: { friends: req.user._id }
    });

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend requests
router.get('/friend-requests', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.user', 'fullName username email profileImage')
      .select('friendRequests');

    const pendingRequests = user.friendRequests.filter(req => req.status === 'pending');

    res.json({ friendRequests: pendingRequests });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
