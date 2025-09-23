# Project Manager

A comprehensive collaborative project management application with real-time teamwork capabilities, Kanban boards, role-based permissions, and intelligent notifications. Built with modern web technologies for seamless project coordination and team collaboration.

## 🌟 Overview

Project Manager is a full-stack web application designed to streamline team collaboration and project management workflows. It combines the power of real-time communication, intuitive drag-and-drop interfaces, and robust user management to create an efficient project management ecosystem.

## 🚀 Features

### Authentication & Security
- **Secure JWT Authentication** with bcryptjs password hashing
- **Role-based Access Control** (Viewer, Editor, Admin permissions)
- **Password Reset & Account Management**
- **Session Management** with automatic token refresh

### User Management
- **Friends System** - Add and search users via email or username
- **Profile Management** - Update name, username, email, and password
- **Online Status Tracking** with last seen timestamps
- **User Search & Discovery**

### Project Management
- **Project Creation & Management** with detailed descriptions
- **Team Invitations** with role assignment
- **Project Info Pages** with Markdown support
- **Project-based Permission System**
- **Project Dashboard** with activity overview

### Task Management
- **Interactive Kanban Boards** with drag-and-drop functionality
- **Task Cards** with detailed descriptions, due dates, and assignments
- **Task Limits** per column to manage workflow
- **Task Status Tracking** (To Do, In Progress, Done, etc.)
- **Task Assignment** to team members

### Communication & Collaboration
- **Real-time Updates** via Socket.io for instant synchronization
- **Notes System** with categorized tags (notice, issue, reminder, important, other)
- **Notification System** for invites, task updates, and team activities
- **Activity Feed** for project updates

### User Interface
- **Modern Responsive Design** with Tailwind CSS
- **Collapsible Sidebar** navigation
- **Teal & White Theme** with consistent branding
- **Mobile-Friendly** interface
- **Drag-and-Drop** powered by Atlassian's Pragmatic DnD

## 🛠️ Tech Stack

### Frontend
- **React.js 19.1.1** - Modern UI framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Vite 7.1.2** - Fast build tool and dev server
- **React Router DOM** - Client-side routing
- **Axios** - HTTP client with interceptors
- **React Hot Toast** - Elegant notifications
- **React Markdown** - Markdown rendering
- **Atlassian Pragmatic DnD** - Accessible drag-and-drop
- **Lucide React** - Beautiful icons
- **TanStack React Query** - Server state management
- **Socket.io Client** - Real-time communication

### Backend
- **Node.js** - JavaScript runtime
- **Express.js 5.1.0** - Web application framework
- **Socket.io 4.8.1** - Real-time bidirectional communication
- **Mongoose 8.18.1** - MongoDB object modeling
- **JSON Web Tokens** - Secure authentication
- **bcryptjs** - Password hashing
- **Express Validator** - Request validation
- **CORS** - Cross-origin resource sharing

### Database & Infrastructure
- **MongoDB Atlas** - Cloud database service
- **JWT** - Stateless authentication
- **Upstash Redis** - Rate limiting (optional)

### Development Tools
- **Nodemon** - Development server auto-restart
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

## 📁 Project Structure

```
project-manager/
├── backend/                  # Node.js Express backend
│   ├── src/
│   │   ├── config/
│   │   │   └── socket.js     # Socket.io configuration
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT authentication middleware
│   │   ├── models/           # MongoDB/Mongoose models
│   │   │   ├── User.js       # User schema
│   │   │   ├── Project.js    # Project schema
│   │   │   ├── Task.js       # Task schema
│   │   │   ├── Note.js       # Note schema
│   │   │   └── Notification.js # Notification schema
│   │   ├── routes/           # API route handlers
│   │   │   ├── auth.js       # Authentication routes
│   │   │   ├── users.js      # User management
│   │   │   ├── projects.js   # Project CRUD operations
│   │   │   ├── tasks.js      # Task management
│   │   │   ├── notes.js      # Notes system
│   │   │   └── notifications.js # Notification system
│   │   ├── utils/
│   │   │   └── notificationCleanup.js # Background cleanup
│   │   └── server.js         # Main server file
│   ├── package.json
│   └── .env                  # Environment variables
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Layout.tsx    # Main layout wrapper
│   │   │   └── ProtectedRoute.tsx # Route protection
│   │   ├── contexts/         # React contexts
│   │   │   ├── AuthContext.tsx # Authentication state
│   │   │   └── SocketContext.tsx # Socket.io integration
│   │   ├── lib/
│   │   │   └── api.ts        # Axios API configuration
│   │   ├── pages/            # Application pages
│   │   │   ├── LandingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ProjectsPage.tsx
│   │   │   ├── ProjectDetail.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   └── TeamsPage.tsx
│   │   ├── App.tsx           # Main app component
│   │   ├── main.tsx          # React entry point
│   │   └── index.css         # Global styles
│   ├── package.json
│   ├── vite.config.ts        # Vite configuration
│   ├── tailwind.config.js    # Tailwind CSS config
│   └── tsconfig.json         # TypeScript configuration
└── README.md
```

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **MongoDB Atlas** account (or local MongoDB installation)
- **Git** for version control

### 1. Clone the Repository

```bash
git clone https://github.com/Sy-Nipun04/project-manager.git
cd project-manager
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `backend/.env` with your configuration:

```env
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/project-manager?retryWrites=true&w=majority&appName=Cluster0
# For local MongoDB: mongodb://localhost:27017/project-manager

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_please_change_this_in_production

# Server Configuration
PORT=5000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Optional: Redis configuration for rate limiting
# UPSTASH_REDIS_REST_URL=your_upstash_redis_url
# UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

**Important Security Notes:**
- Generate a strong JWT secret for production
- Use environment-specific database URIs
- Never commit `.env` files to version control

### 4. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Create environment file (optional)
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

### 5. Database Setup

#### Option A: MongoDB Atlas (Recommended)
1. Create a [MongoDB Atlas](https://www.mongodb.com/atlas) account
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string
5. Update `MONGODB_URI` in `backend/.env`

#### Option B: Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service
3. Use: `MONGODB_URI=mongodb://localhost:27017/project-manager`

## � Running the Application

### Development Mode

1. **Start Backend Server:**
   ```bash
   cd backend
   npm run dev
   ```
   Backend will run on `http://localhost:5000`

2. **Start Frontend Development Server:**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

3. **Access the Application:**
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000/api](http://localhost:5000/api)
   - API Health Check: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### Production Mode

1. **Build Frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start Backend in Production:**
   ```bash
   cd backend
   npm start
   ```

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### User Management
- `GET /api/users` - Get all users
- `GET /api/users/search` - Search users
- `PUT /api/users/profile` - Update profile
- `POST /api/users/friend-request` - Send friend request

### Project Management
- `GET /api/projects` - Get user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/invite` - Invite users to project

### Task Management
- `GET /api/tasks/project/:projectId` - Get project tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PUT /api/tasks/:id/move` - Move task between columns

### Additional Features
- `GET /api/notes` - Get notes
- `POST /api/notes` - Create note
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## 🔧 Configuration

### Frontend Configuration
- **API Base URL**: Set `VITE_API_URL` in `frontend/.env`
- **Build Settings**: Modify `vite.config.ts`
- **Styling**: Customize `tailwind.config.js`

### Backend Configuration
- **CORS Settings**: Update allowed origins in `server.js`
- **Socket.io Configuration**: Modify `config/socket.js`
- **Database Settings**: Update connection in `server.js`

## 🧪 Usage Examples

### User Registration Requirements
- **Full Name**: 2-100 characters
- **Username**: 3-30 characters (letters, numbers, underscores only)
- **Email**: Valid email format
- **Password**: Minimum 6 characters

### Creating Your First Project
1. Register/Login to your account
2. Navigate to Projects page
3. Click "Create New Project"
4. Fill in project details with Markdown support
5. Invite team members via email/username
6. Set up Kanban columns and start adding tasks

## 🚨 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Kill process using port 5000
npx kill-port 5000
# Or change PORT in backend/.env
```

**MongoDB Connection Failed:**
- Verify your MongoDB URI
- Check database user permissions
- Ensure IP is whitelisted (Atlas)

**Frontend Build Issues:**
```bash
# Clear npm cache
npm cache clean --force
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**CORS Errors:**
- Verify `FRONTEND_URL` in backend `.env`
- Check allowed origins in `server.js`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License. See the LICENSE file for details.

## 👥 Team

- **Developer**: [Sy-Nipun04](https://github.com/Sy-Nipun04)
- **Contributor**: [Anshul Parkar](https://github.com/username)

## 📞 Support

For support, email support@projectmanager.com or create an issue on GitHub.

---
