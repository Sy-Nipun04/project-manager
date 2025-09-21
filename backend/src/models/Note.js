import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Note title is required'],
    trim: true,
    maxlength: [200, 'Note title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Note content is required'],
    trim: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  type: {
    type: String,
    enum: ['notice', 'issue', 'reminder', 'important', 'other'],
    required: [true, 'Note type is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  taggedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  referencedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  isArchived: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
noteSchema.index({ project: 1, isArchived: 1 });
noteSchema.index({ createdBy: 1 });
noteSchema.index({ taggedUsers: 1 });

export default mongoose.model('Note', noteSchema);
