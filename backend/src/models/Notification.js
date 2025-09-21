import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'project_invitation',
      'task_assigned',
      'task_created',
      'task_moved',
      'note_created',
      'note_tagged',
      'member_added',
      'member_removed',
      'role_changed',
      'project_updated',
      'friend_request',
      'friend_accepted',
      'invitation_accepted',
      'invitation_declined'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitation: {
      type: String  // Store as string since it's a subdocument ID
    },
    actionTaken: {
      type: String,
      enum: ['accepted', 'declined'],
      default: null
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
