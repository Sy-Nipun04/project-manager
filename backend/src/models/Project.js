import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  markdownContent: {
    type: String,
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    doingColumnLimit: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  },
  invitations: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Ensure creator is always an admin member
projectSchema.pre('save', function(next) {
  if (this.isNew) {
    const creatorMember = {
      user: this.creator,
      role: 'admin',
      joinedAt: new Date()
    };
    
    // Check if creator is already in members
    const existingMember = this.members.find(member => 
      member.user.toString() === this.creator.toString()
    );
    
    if (!existingMember) {
      this.members.push(creatorMember);
    }
  }
  next();
});

// Index for better query performance
projectSchema.index({ creator: 1 });
projectSchema.index({ 'members.user': 1 });

export default mongoose.model('Project', projectSchema);
