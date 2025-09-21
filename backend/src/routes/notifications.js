import express from 'express';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get user notifications
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, unreadOnly = false, last7Days = false } = req.query;
    
    // Automatically delete notifications older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    await Notification.deleteMany({
      user: req.user._id,
      createdAt: { $lt: sevenDaysAgo }
    });
    
    const query = { user: req.user._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    // If last7Days is true, show all notifications from last 7 days
    if (last7Days === 'true') {
      query.createdAt = { $gte: sevenDaysAgo };
    }

    const notifications = await Notification.find(query)
      .populate('data.project', 'name')
      .populate('data.task', 'title')
      .populate('data.note', 'title')
      .populate('data.user', 'fullName username email profileImage')
      .sort({ createdAt: -1 })
      .limit(last7Days === 'true' ? 0 : limit * 1)  // No limit for 7-day view
      .skip(last7Days === 'true' ? 0 : (page - 1) * limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      user: req.user._id, 
      isRead: false 
    });

    // Count notifications in last 7 days
    const last7DaysCount = await Notification.countDocuments({
      user: req.user._id,
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      notifications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        unreadCount,
        last7DaysCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: req.params.notificationId, 
        user: req.user._id 
      },
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ 
      message: 'Notification marked as read',
      notification 
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.notificationId,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear all notifications
router.delete('/', async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });

    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ 
      user: req.user._id, 
      isRead: false 
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
