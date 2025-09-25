import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  note: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  }
}, {
  timestamps: true
});

// Ensure a user can only bookmark a note once
bookmarkSchema.index({ user: 1, note: 1 }, { unique: true });

// Index for better query performance
bookmarkSchema.index({ user: 1, project: 1 });
bookmarkSchema.index({ note: 1 });

export default mongoose.model('Bookmark', bookmarkSchema);