import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import noteRoutes from './routes/notes.js';
import notificationRoutes from './routes/notifications.js';
import { authenticateToken } from './middleware/auth.js';
import { setupSocketHandlers } from './config/socket.js';
import { startNotificationCleanup } from './utils/notificationCleanup.js';
import { startActivityCleanup } from './utils/activityCleanup.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection with enhanced error handling
mongoose.set('strictQuery', true);

const connectToDatabase = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 30000, // Timeout after 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Maintain minimum of 1 socket connection
    };

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/project-manager', options);
    console.log('✅ Connected to MongoDB successfully');

    // Connection event listeners
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    // Handle process termination gracefully
    process.on('SIGINT', async () => {
      console.log('Received SIGINT. Closing MongoDB connection...');
      await mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM. Closing MongoDB connection...');
      await mongoose.connection.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    
    // If it's a network error, retry after 5 seconds
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
      console.log('🔄 Retrying MongoDB connection in 5 seconds...');
      setTimeout(connectToDatabase, 5000);
    } else {
      console.error('💥 Critical MongoDB error. Exiting...');
      process.exit(1);
    }
  }
};

// Initialize database connection
connectToDatabase();

// Socket.io setup
setupSocketHandlers(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/notes', authenticateToken, noteRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start the cleanup schedulers
  startNotificationCleanup();
  startActivityCleanup();
});

export { io };
