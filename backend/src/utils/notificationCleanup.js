import Notification from '../models/Notification.js';

// Clean up notifications older than 7 days
export const cleanupOldNotifications = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const result = await Notification.deleteMany({
      createdAt: { $lt: sevenDaysAgo }
    });
    
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} old notifications`);
    }
    
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    return 0;
  }
};

// Start periodic cleanup (runs every 24 hours)
export const startNotificationCleanup = () => {
  // Run immediately on startup
  cleanupOldNotifications();
  
  // Then run every 24 hours
  setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000);
  
  console.log('Notification cleanup scheduler started');
};