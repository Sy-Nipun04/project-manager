
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { SidebarProvider } from './contexts/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth_pages/LoginPage';
import RegisterPage from './pages/auth_pages/RegisterPage';
import Dashboard from './pages/navbar_pages/Dashboard';
import ProjectsPage from './pages/navbar_pages/ProjectsPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/navbar_pages/NotificationsPage';
import SocialPage from './pages/navbar_pages/SocialPage';
import SelectProjectPage from './pages/project_pages/ProjectPlaceholderPage';
import ProjectBoardPage from './pages/project_pages/ProjectBoardPage';
import ProjectInfoPage from './pages/project_pages/ProjectInfoPage';
import ProjectTeamPage from './pages/project_pages/ProjectTeamPage';
import ProjectNotesPage from './pages/project_pages/ProjectNotesPage';
import ProjectSettingsPage from './pages/project_pages/ProjectSettingsPage';
import ProjectRedirect from './components/ProjectRedirect';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <SidebarProvider>
            <Router>
            <div className="min-h-screen bg-gray-50">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                
                {/* Protected routes */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <ProjectsPage />
                  </ProtectedRoute>
                } />
                <Route path="/social" element={
                  <ProtectedRoute>
                    <SocialPage />
                  </ProtectedRoute>
                } />
                <Route path="/project/:projectId" element={
                  <ProtectedRoute>
                    <ProjectRedirect />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                } />
                <Route path="/select-project" element={
                  <ProtectedRoute>
                    <SelectProjectPage />
                  </ProtectedRoute>
                } />
                
                {/* Project-specific routes */}
                <Route path="/project/:projectId/board" element={
                  <ProtectedRoute>
                    <ProjectBoardPage />
                  </ProtectedRoute>
                } />
                <Route path="/project/:projectId/info" element={
                  <ProtectedRoute>
                    <ProjectInfoPage />
                  </ProtectedRoute>
                } />
                <Route path="/project/:projectId/team" element={
                  <ProtectedRoute>
                    <ProjectTeamPage />
                  </ProtectedRoute>
                } />
                <Route path="/project/:projectId/notes" element={
                  <ProtectedRoute>
                    <ProjectNotesPage />
                  </ProtectedRoute>
                } />
                <Route path="/project/:projectId/settings" element={
                  <ProtectedRoute>
                    <ProjectSettingsPage />
                  </ProtectedRoute>
                } />
                
                {/* Redirect to dashboard for any other route */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    style: {
                      background: '#10b981',
                    },
                  },
                  error: {
                    style: {
                      background: '#ef4444',
                    },
                  },
                }}
              />
            </div>
          </Router>
        </SidebarProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;