# Project Manager - Setup Instructions

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```

## Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the frontend directory with the following variables:
   ```
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```

## Environment Variables Required

### Backend (.env)
- `MONGODB_URI`: Your MongoDB Atlas connection string
- `JWT_SECRET`: A secure secret key for JWT token signing
- `PORT`: Port for the backend server (default: 5000)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:5173)

### Frontend (.env.local)
- `VITE_API_URL`: Backend API URL (default: http://localhost:5000/api)
- `VITE_SOCKET_URL`: Socket.io server URL (default: http://localhost:5000)

## Features Implemented

### Backend
- ✅ Express.js server with MongoDB integration
- ✅ JWT authentication with bcryptjs password hashing
- ✅ User model with friends system
- ✅ Project model with role-based access control
- ✅ Task model for Kanban board functionality
- ✅ Note model with tagging and task references
- ✅ Notification system
- ✅ Socket.io for real-time updates
- ✅ Comprehensive API routes for all features

### Frontend
- ✅ React with TypeScript
- ✅ React Router for navigation
- ✅ TanStack Query for data fetching
- ✅ Authentication context and protected routes
- ✅ Socket.io client integration
- ✅ Beautiful landing page with teal/white theme
- ✅ Login and registration pages
- ✅ Main layout with navigation
- ✅ Dashboard with project overview
- ✅ Placeholder pages for all main features

## Next Steps

The foundation is complete! The remaining features to implement include:

1. **Projects Page**: Complete project listing with expandable details and create project functionality
2. **Project Detail Page**: Implement the collapsible sidebar with all sections
3. **Kanban Board**: Add drag-and-drop functionality using Atlassian's pragmatic drag and drop
4. **Friends System**: Complete the friends management interface
5. **Profile Page**: User profile editing and password change
6. **Notifications Page**: Real-time notifications display
7. **Notes System**: Complete notes management with tagging
8. **Project Settings**: Project configuration and secure deletion

## Running the Application

1. Start the backend server (from backend directory):
   ```bash
   npm run dev
   ```

2. Start the frontend server (from frontend directory):
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

The application will be fully functional with authentication, and you can start creating projects and managing tasks!
