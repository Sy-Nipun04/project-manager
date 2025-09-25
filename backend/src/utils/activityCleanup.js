import Activity from '../models/Activity.js';
import Project from '../models/Project.js';

// Clean up activities to keep only the 15 most recent per project
export const cleanupOldActivities = async () => {
  try {
    let totalDeleted = 0;
    
    // Get all projects
    const projects = await Project.find({}, '_id');
    
    for (const project of projects) {
      // Get all activities for this project, sorted by most recent first
      const allActivities = await Activity.find({
        project: project._id
      })
      .sort({ createdAt: -1 })
      .select('_id');

      // If we have more than 15 activities, delete the older ones
      if (allActivities.length > 15) {
        const activitiesToKeep = allActivities.slice(0, 15);
        const activityIdsToKeep = activitiesToKeep.map(activity => activity._id);
        
        const result = await Activity.deleteMany({
          project: project._id,
          _id: { $nin: activityIdsToKeep }
        });
        
        totalDeleted += result.deletedCount;
      }
    }
    
    if (totalDeleted > 0) {
      console.log(`Cleaned up ${totalDeleted} old activities (keeping 15 most recent per project)`);
    }
    
    return totalDeleted;
  } catch (error) {
    console.error('Error cleaning up activities:', error);
    return 0;
  }
};

// Start periodic cleanup (runs every 24 hours)
export const startActivityCleanup = () => {
  // Run immediately on startup
  cleanupOldActivities();
  
  // Then run every 24 hours
  setInterval(cleanupOldActivities, 24 * 60 * 60 * 1000);
  
  console.log('Activity cleanup scheduler started');
};