import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['note_created', 'note_updated', 'note_deleted', 'task_created', 'task_updated', 'task_deleted', 'member_added', 'member_removed'],
    required: true
  },
  action: {
    type: String,
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // The ID of the note/task that was affected (may be null if deleted)
  },
  targetTitle: {
    type: String,
    required: true // Store the title so we can show it even after deletion
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    required: false // Additional data like old/new values
  }
}, {
  timestamps: true
});

// Index for better query performance
activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ user: 1 });
activitySchema.index({ type: 1 });

export default mongoose.model('Activity', activitySchema);