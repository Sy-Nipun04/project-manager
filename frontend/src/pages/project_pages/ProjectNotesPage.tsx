import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { usePermissions } from '../../hooks/usePermissions';
import { 
  DocumentTextIcon, 
  PlusIcon, 
  MagnifyingGlassIcon, 
  FolderIcon,
  ClockIcon,
  UserIcon,
  PencilIcon,
  TrashIcon,
  BookmarkIcon
} from '@heroicons/react/24/outline';
import { 
  DocumentTextIcon as DocumentTextIconSolid,
  BookmarkIcon as BookmarkIconSolid 
} from '@heroicons/react/24/solid';

const ProjectNotesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const { can, isMember } = usePermissions();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}`);
      return response.data.project;
    },
    enabled: !!projectId
  });

  // Auto-select the project in sidebar when viewing it
  useEffect(() => {
    if (project && (!selectedProject || selectedProject._id !== project._id)) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
          <p className="text-gray-600">The requested project could not be found.</p>
        </div>
      </Layout>
    );
  }

  if (!isMember) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have access to this project. Contact an admin to be added as a member.</p>
        </div>
      </Layout>
    );
  }

  // Mock notes data for placeholder
  const mockNotes = [
    {
      id: 1,
      title: "Project Requirements & Specifications",
      content: "This note contains the detailed project requirements and technical specifications. It includes user stories, acceptance criteria, and technical constraints.",
      author: "John Doe",
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20'),
      isBookmarked: true,
      tags: ["requirements", "specs", "important"]
    },
    {
      id: 2,
      title: "Meeting Notes - Sprint Planning",
      content: "Sprint planning meeting notes from January 18th. Discussed story points, team capacity, and sprint goals.",
      author: "Jane Smith",
      createdAt: new Date('2024-01-18'),
      updatedAt: new Date('2024-01-18'),
      isBookmarked: false,
      tags: ["meeting", "sprint", "planning"]
    },
    {
      id: 3,
      title: "Architecture Decision Records",
      content: "Documentation of key architectural decisions made for the project including database design, API structure, and deployment strategy.",
      author: "Mike Johnson",
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-22'),
      isBookmarked: true,
      tags: ["architecture", "decisions", "technical"]
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project Notes</h1>
              <p className="text-gray-600">
                Collaborative documentation and meeting notes for {project.name}
              </p>
            </div>
          </div>
          
          {can.createNotes() && (
            <button className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
              <PlusIcon className="h-4 w-4 mr-2" />
              New Note
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Tags</option>
                <option value="requirements">Requirements</option>
                <option value="meeting">Meetings</option>
                <option value="architecture">Architecture</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notes List */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {mockNotes.map((note) => (
                <div key={note.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <DocumentTextIconSolid className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900 hover:text-purple-600 cursor-pointer">
                        {note.title}
                      </h3>
                      {note.isBookmarked && (
                        <BookmarkIconSolid className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-1 text-gray-400 hover:text-purple-600">
                        <BookmarkIcon className="h-4 w-4" />
                      </button>
                      {can.editNotes() && (
                        <>
                          <button className="p-1 text-gray-400 hover:text-blue-600">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button className="p-1 text-gray-400 hover:text-red-600">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-4 line-clamp-3">
                    {note.content}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <UserIcon className="h-4 w-4" />
                        <span>{note.author}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="h-4 w-4" />
                        <span>Updated {note.updatedAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button className="text-purple-600 hover:text-purple-700 font-medium">
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Empty State */}
            {mockNotes.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                <FolderIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
                <p className="text-gray-600 mb-4">
                  Start documenting your project by creating your first note.
                </p>
                {can.createNotes() && (
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                    Create First Note
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900 mb-3">Notes Overview</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Notes</span>
                  <span className="font-medium">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bookmarked</span>
                  <span className="font-medium">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">This Week</span>
                  <span className="font-medium">1</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="text-gray-900">Mike updated "Architecture Decision Records"</p>
                  <p className="text-gray-500">2 hours ago</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-900">Jane created "Meeting Notes - Sprint Planning"</p>
                  <p className="text-gray-500">1 day ago</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-900">John updated "Project Requirements"</p>
                  <p className="text-gray-500">3 days ago</p>
                </div>
              </div>
            </div>

            {/* Coming Soon Features */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4">
              <h4 className="font-medium text-purple-900 mb-2">🚀 Coming Soon</h4>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Rich text editor</li>
                <li>• File attachments</li>
                <li>• Real-time collaboration</li>
                <li>• Note templates</li>
                <li>• Advanced search</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectNotesPage;