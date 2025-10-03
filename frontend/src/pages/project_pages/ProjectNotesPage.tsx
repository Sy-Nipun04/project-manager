import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useProject } from '../../hooks/useProject';
import { 
  DocumentTextIcon, 
  PlusIcon, 
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  BookmarkIcon,
  ClockIcon,
  TagIcon,
  UserGroupIcon,
  BellIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { TaskSelectionModal } from '../../components/notes/TaskSelectionModal';

interface Note {
  _id: string;
  title: string;
  content: string;
  type: 'notice' | 'issue' | 'reminder' | 'important' | 'other';
  author: {
    _id: string;
    fullName: string;
    username: string;
  };
  taggedMembers: Array<{
    _id: string;
    fullName: string;
    username: string;
  }>;
  referencedTasks: Array<{
    _id: string;
    title: string;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
  isBookmarked?: boolean;
}



interface Member {
  user: {
    _id: string;
    fullName: string;
    username: string;
  };
  role: string;
}

const ProjectNotesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  
  const [activeTab, setActiveTab] = useState<'all' | 'bookmarks' | 'activity'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [showImportantConfirm, setShowImportantConfirm] = useState(false);
  const [pendingNoteData, setPendingNoteData] = useState<any>(null);
  
  // Form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'notice' | 'issue' | 'reminder' | 'important' | 'other'>('notice');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [taggedMembers, setTaggedMembers] = useState<Array<{_id: string; fullName: string; username: string}>>([]);
  const [showTaskSelectionModal, setShowTaskSelectionModal] = useState(false);

  // Original values for change detection in edit mode
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalType, setOriginalType] = useState<'notice' | 'issue' | 'reminder' | 'important' | 'other'>('notice');
  const [originalMembers, setOriginalMembers] = useState<string[]>([]);
  const [originalTasks, setOriginalTasks] = useState<string[]>([]);

  // Fetch project data
  const { project, isLoading } = useProject(projectId);

  // Get permissions using fresh project data
  const { can, isMember, userRole } = usePermissions(project);

  // Fetch notes
  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ['notes', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}/notes`);
      return response.data.notes;
    },
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: 'always', // Always get fresh data when component mounts
    refetchOnWindowFocus: true // Refetch when user comes back to tab
  });

  // Fetch tasks for referencing
  const { data: tasks } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}/tasks`);
      return response.data.tasks;
    },
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: 'always', // Always get fresh data
    refetchOnWindowFocus: true // Refetch when user comes back to tab
  });

  // Fetch bookmarked notes
  const { data: bookmarkedNotes } = useQuery({
    queryKey: ['bookmarked-notes', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}/notes/bookmarks`);
      return response.data.notes;
    },
    enabled: !!projectId && activeTab === 'bookmarks',
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: 'always', // Always get fresh data
    refetchOnWindowFocus: true // Refetch when user comes back to tab
  });

  // Fetch recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ['notes-activity', projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${projectId}/notes/activity`);
      return response.data.activities;
    },
    enabled: !!projectId && activeTab === 'activity',
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: 'always', // Always get fresh data
    refetchOnWindowFocus: true // Refetch when user comes back to tab
  });

  // Auto-select the project in sidebar
  useEffect(() => {
    if (project && (!selectedProject || selectedProject._id !== project._id)) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

  // Real-time socket listeners for notes
  useEffect(() => {
    if (!socket || !projectId) return;

    console.log('🔗 Setting up note socket listeners for project:', projectId);

    // Join project room for real-time updates
    socket.emit('join_project', projectId);

    // Handle note events
    const handleNoteCreated = (data: any) => {
      console.log('📝 Received note-created event:', data);
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['bookmarked-notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['notes-activity', projectId] });
    };

    const handleNoteUpdated = (data: any) => {
      console.log('✏️ Received note-updated event:', data);
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['bookmarked-notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['notes-activity', projectId] });
    };

    const handleNoteDeleted = (data: any) => {
      console.log('🗑️ Received note-deleted event:', data);
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['bookmarked-notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['notes-activity', projectId] });
    };

    const handleProjectDeleted = (data: any) => {
      console.log('🗑️ Project deleted event received:', data);
      if (data.project === projectId || data.projectId === projectId) {
        queryClient.removeQueries({ queryKey: ['project', projectId] });
        toast.error('This project has been deleted');
        window.location.href = '/projects';
      }
    };

    // Handle archive events
    const handleProjectUpdated = (data: any) => {
      if (data.updateType === 'archived') {
        console.log('📦 ProjectNotesPage: Project archived, redirecting with page refresh');
        window.location.href = '/dashboard';
      }
    };

    // Register event listeners
    socket.on('note-created', handleNoteCreated);
    socket.on('note-updated', handleNoteUpdated);
    socket.on('note-deleted', handleNoteDeleted);
    socket.on('project_deleted', handleProjectDeleted);
    socket.on('project_updated', handleProjectUpdated);

    return () => {
      // Clean up listeners
      socket.off('note-created', handleNoteCreated);
      socket.off('note-updated', handleNoteUpdated);
      socket.off('note-deleted', handleNoteDeleted);
      socket.off('project_deleted', handleProjectDeleted);
      socket.off('project_updated', handleProjectUpdated);
      
      // Leave project room
      socket.emit('leave_project', projectId);
    };
  }, [socket, projectId, queryClient]);

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: any) => {
      const response = await api.post(`/projects/${projectId}/notes`, noteData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['notes-activity', projectId] });
      resetForm();
      setShowCreateModal(false);
      toast.success('Note created successfully');
    },
    onError: (error: any) => {
      // Clear pending important note data on error
      setPendingNoteData(null);
      setShowImportantConfirm(false);
      toast.error(error.response?.data?.message || 'Failed to create note');
    }
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, noteData }: { noteId: string; noteData: any }) => {
      const response = await api.put(`/projects/${projectId}/notes/${noteId}`, noteData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['notes-activity', projectId] });
      resetForm();
      setShowEditModal(false);
      setEditingNote(null);
      toast.success('Note updated successfully');
    },
    onError: (error: any) => {
      // Clear pending important note data on error
      setPendingNoteData(null);
      setShowImportantConfirm(false);
      toast.error(error.response?.data?.message || 'Failed to update note');
    }
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await api.delete(`/projects/${projectId}/notes/${noteId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['notes-activity', projectId] });
      toast.success('Note deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete note');
    }
  });

  // Bookmark note mutation
  const bookmarkMutation = useMutation({
    mutationFn: async ({ noteId, bookmark }: { noteId: string; bookmark: boolean }) => {
      const response = await api.post(`/projects/${projectId}/notes/${noteId}/bookmark`, { bookmark });
      return response.data;
    },
    onMutate: async ({ noteId, bookmark }) => {
      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['notes', projectId] });
      await queryClient.cancelQueries({ queryKey: ['bookmarked-notes', projectId] });

      // Snapshot the previous values
      const previousNotes = queryClient.getQueryData(['notes', projectId]);
      const previousBookmarkedNotes = queryClient.getQueryData(['bookmarked-notes', projectId]);

      // Optimistically update the notes list
      queryClient.setQueryData(['notes', projectId], (old: any) => {
        if (!old?.notes) return old;
        return {
          ...old,
          notes: old.notes.map((note: Note) => 
            note._id === noteId ? { ...note, isBookmarked: bookmark } : note
          )
        };
      });

      // Return a context object with the snapshotted values
      return { previousNotes, previousBookmarkedNotes };
    },
    onError: (error: any, _variables, context) => {
      // Rollback on error
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes', projectId], context.previousNotes);
      }
      if (context?.previousBookmarkedNotes) {
        queryClient.setQueryData(['bookmarked-notes', projectId], context.previousBookmarkedNotes);
      }
      toast.error(error.response?.data?.message || 'Failed to update bookmark');
    },
    onSuccess: (_, variables) => {
      toast.success(variables.bookmark ? 'Note bookmarked' : 'Bookmark removed');
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['bookmarked-notes', projectId] });
    }
  });

  // Helper function to detect if there are any changes in the edit form
  const hasChanges = () => {
    if (!editingNote) return false;
    
    return (
      noteTitle !== originalTitle ||
      noteContent !== originalContent ||
      noteType !== originalType ||
      JSON.stringify(selectedMembers.sort()) !== JSON.stringify(originalMembers.sort()) ||
      JSON.stringify(selectedTasks.sort()) !== JSON.stringify(originalTasks.sort())
    );
  };

  // Helper functions for member management
  const addMember = (member: {_id: string; fullName: string; username: string}) => {
    if (!taggedMembers.find(m => m._id === member._id)) {
      const newTaggedMembers = [...taggedMembers, member];
      setTaggedMembers(newTaggedMembers);
      setSelectedMembers(newTaggedMembers.map(m => m._id));
    }
    setMemberSearch('');
  };

  const removeMember = (memberId: string) => {
    const newTaggedMembers = taggedMembers.filter(m => m._id !== memberId);
    setTaggedMembers(newTaggedMembers);
    setSelectedMembers(newTaggedMembers.map(m => m._id));
  };

  // Helper function to handle task selection
  const handleTaskSelection = (taskIds: string[]) => {
    setSelectedTasks(taskIds);
  };

  const resetForm = () => {
    setNoteTitle('');
    setNoteContent('');
    setNoteType('notice');
    setSelectedMembers([]);
    setSelectedTasks([]);
    setMemberSearch('');
    setTaggedMembers([]);
    setShowTaskSelectionModal(false);
    
    // Clear original values for change detection
    setOriginalTitle('');
    setOriginalContent('');
    setOriginalType('notice');
    setOriginalMembers([]);
    setOriginalTasks([]);
    
    // Clear pending important note data
    setPendingNoteData(null);
    setShowImportantConfirm(false);
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent submission if confirmation modal is already showing
    if (showImportantConfirm) {
      return;
    }
    
    const noteData = {
      title: noteTitle,
      content: noteContent,
      type: noteType,
      taggedMembers: selectedMembers,
      referencedTasks: selectedTasks
    };

    // If marking as important, show confirmation
    if (noteType === 'important') {
      console.log('Setting up important note confirmation', noteData);
      setPendingNoteData(noteData);
      setShowImportantConfirm(true);
      return;
    }

    console.log('Creating note directly', noteData);
    createNoteMutation.mutate(noteData);
  };

  const handleEditNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    
    // Prevent submission if confirmation modal is already showing
    if (showImportantConfirm) {
      return;
    }
    
    const noteData = {
      title: noteTitle,
      content: noteContent,
      type: noteType,
      taggedMembers: selectedMembers,
      referencedTasks: selectedTasks
    };

    // If changing to important or already important, show confirmation
    if (noteType === 'important' && editingNote.type !== 'important') {
      setPendingNoteData({ noteId: editingNote._id, noteData });
      setShowImportantConfirm(true);
      return;
    }

    updateNoteMutation.mutate({ noteId: editingNote._id, noteData });
  };

  const confirmImportantNote = () => {
    if (!pendingNoteData) {
      console.error('No pending note data found');
      setShowImportantConfirm(false);
      return;
    }

    console.log('Confirming important note with data:', pendingNoteData);
    
    if (pendingNoteData.noteId) {
      // Editing existing note
      console.log('Updating existing note');
      updateNoteMutation.mutate(pendingNoteData);
    } else {
      // Creating new note
      console.log('Creating new important note');
      createNoteMutation.mutate(pendingNoteData);
    }
    
    // Clear state immediately after triggering mutation
    setShowImportantConfirm(false);
    setPendingNoteData(null);
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    
    // Set current values
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteType(note.type);
    setSelectedMembers(note.taggedMembers.map(m => m._id));
    setSelectedTasks(note.referencedTasks.map(t => t._id));
    setTaggedMembers(note.taggedMembers);
    
    // Set original values for change detection
    setOriginalTitle(note.title);
    setOriginalContent(note.content);
    setOriginalType(note.type);
    setOriginalMembers(note.taggedMembers.map(m => m._id));
    setOriginalTasks(note.referencedTasks.map(t => t._id));
    
    setShowEditModal(true);
  };

  const handleDeleteNote = (note: Note) => {
    setNoteToDelete(note);
    setShowDeleteModal(true);
  };

  const confirmDeleteNote = () => {
    if (noteToDelete) {
      deleteNoteMutation.mutate(noteToDelete._id);
      setShowDeleteModal(false);
      setNoteToDelete(null);
    }
  };

  const cancelDeleteNote = () => {
    setShowDeleteModal(false);
    setNoteToDelete(null);
  };

  const toggleBookmark = (note: Note) => {
    bookmarkMutation.mutate({
      noteId: note._id,
      bookmark: !note.isBookmarked
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'important':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'issue':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reminder':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'notice':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };



  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'important':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'issue':
        return <InformationCircleIcon className="h-4 w-4" />;
      case 'reminder':
        return <ClockIcon className="h-4 w-4" />;
      case 'notice':
        return <BellIcon className="h-4 w-4" />;
      default:
        return <DocumentTextIcon className="h-4 w-4" />;
    }
  };

  const canCreateNotes = can.createNotes && can.createNotes();

  // Filter members for search dropdown
  const filteredMembers = project?.members?.filter((member: Member) => {
    const searchLower = memberSearch.toLowerCase();
    const alreadyTagged = taggedMembers.some(tagged => tagged._id === member.user._id);
    const isCurrentUser = member.user._id === currentUser?.id;
    return !alreadyTagged && !isCurrentUser && (
      member.user.fullName.toLowerCase().includes(searchLower) ||
      member.user.username.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Convert tasks format for TaskSelectionModal
  const allTasks = tasks ? Object.values(tasks).flat() : [];
  const formattedTasks = React.useMemo(() => {
    return allTasks.map((task: any) => ({
      _id: task._id,
      title: task.title,
      description: task.description || '',
      column: task.column || 'todo'
    }));
  }, [allTasks]);

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
          <p className="text-gray-600">You do not have access to this project.</p>
        </div>
      </Layout>
    );
  }

  const currentNotes = (() => {
    const baseNotes = activeTab === 'bookmarks' ? bookmarkedNotes : notes;
    if (!searchQuery || !baseNotes) return baseNotes;
    
    return baseNotes.filter((note: Note) => 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.author.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.taggedMembers?.some(member => 
        member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  })();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600">Project Notes & Documentation</p>
            </div>
          </div>
          
          {canCreateNotes && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Note
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notes by title, content, author, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'all'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Notes ({notes?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bookmarks'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Bookmarked ({notes?.filter((note: Note) => note.isBookmarked).length || 0})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'activity'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Recent Activity
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'activity' ? (
          /* Recent Activity Tab */
          <div className="space-y-4">
            {recentActivity?.length > 0 ? (
              recentActivity.map((activity: any) => (
                <div key={activity._id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        {getTypeIcon(activity.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.createdAt).toLocaleDateString('en-GB')} • {activity.user.fullName}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ClockIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No recent activity found.</p>
              </div>
            )}
            
            {/* Activity Cleanup Information */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">
                    Only the 15 most recent activities are kept. Older activities are automatically removed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Notes Tabs */
          <div className="space-y-4">
            {notesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
              </div>
            ) : currentNotes?.length > 0 ? (
              currentNotes.map((note: Note) => (
                <div key={note._id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{note.title}</h3>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(note.type)}`}>
                          {getTypeIcon(note.type)}
                          <span className="ml-1 capitalize">{note.type}</span>
                        </div>
                      </div>
                      <p className="text-gray-700 mb-4">{note.content}</p>
                      
                      {/* Tagged Members */}
                      {note.taggedMembers?.length > 0 && (
                        <div className="flex items-center space-x-2 mb-2">
                          <UserGroupIcon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-500">Tagged:</span>
                          <div className="flex space-x-1">
                            {note.taggedMembers.map(member => (
                              <span key={member._id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {member.fullName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Referenced Tasks */}
                      {note.referencedTasks?.length > 0 && (
                        <div className="flex items-center space-x-2 mb-2">
                          <TagIcon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-500">Tasks:</span>
                          <div className="flex space-x-1">
                            {note.referencedTasks.map(task => (
                              <span key={task._id} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                {task.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>By {note.author.fullName}</span>
                        <span>•</span>
                        <span>{new Date(note.createdAt).toLocaleDateString('en-GB')}</span>
                        {note.updatedAt !== note.createdAt && (
                          <>
                            <span>•</span>
                            <span>Updated {new Date(note.updatedAt).toLocaleDateString('en-GB')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => toggleBookmark(note)}
                        disabled={bookmarkMutation.isPending}
                        className="p-2 text-gray-400 hover:text-yellow-500 transition-colors disabled:opacity-50"
                        title={note.isBookmarked ? 'Remove bookmark' : 'Bookmark note'}
                      >
                        {note.isBookmarked ? (
                          <BookmarkSolidIcon className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <BookmarkIcon className="h-5 w-5" />
                        )}
                      </button>
                      
                      {note.author._id === currentUser?.id && (
                        <button
                          onClick={() => openEditModal(note)}
                          className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Edit note"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      )}
                      
                      {(note.author._id === currentUser?.id || userRole === 'admin') && (
                        <button
                          onClick={() => handleDeleteNote(note)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete note"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                {searchQuery ? (
                  <>
                    <p>No notes found matching your search criteria.</p>
                    <p className="text-sm mt-2">Try a different search term or clear your search to see all notes.</p>
                  </>
                ) : (
                  <>
                    <p>{activeTab === 'bookmarks' ? 'Bookmarked notes will appear here.' : 'Notes will appear here.'}</p>
                    {activeTab === 'all' && canCreateNotes && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Create a Note
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Note Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Note</h3>
              
              <form onSubmit={handleCreateNote} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { value: 'notice', label: 'Notice', color: 'green' },
                      { value: 'issue', label: 'Issue', color: 'yellow' },
                      { value: 'reminder', label: 'Reminder', color: 'blue' },
                      { value: 'important', label: 'Important', color: 'red' },
                      { value: 'other', label: 'Other', color: 'gray' }
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setNoteType(type.value as any)}
                        className={`p-2 text-xs font-medium rounded-lg border transition-colors ${
                          noteType === type.value
                            ? `bg-${type.color}-100 text-${type.color}-800 border-${type.color}-300`
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tag Members (Optional)</label>
                  
                  {/* Tagged Members Display */}
                  {taggedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {taggedMembers.map((member) => (
                        <span
                          key={member._id}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-800 text-sm rounded-full"
                        >
                          <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {member.fullName.charAt(0)}
                          </div>
                          {member.fullName}
                          <button
                            type="button"
                            onClick={() => removeMember(member._id)}
                            className="text-teal-600 hover:text-teal-800 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Member Search */}
                  {project.members && project.members.length > 0 && (
                    <div className="relative">
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search members to tag..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                      />
                      
                      {/* Search Results */}
                      {memberSearch && filteredMembers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                          {filteredMembers.map((member: Member) => (
                            <button
                              key={member.user._id}
                              type="button"
                              onClick={() => addMember(member.user)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                            >
                              <div className="w-6 h-6 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {member.user.fullName.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{member.user.fullName}</div>
                                <div className="text-xs text-gray-500">@{member.user.username}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference Tasks (Optional)</label>
                  
                  {/* Selected Tasks Display */}
                  {selectedTasks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedTasks.map((taskId) => {
                        const task = formattedTasks.find(t => t._id === taskId);
                        if (!task) return null;
                        return (
                          <span
                            key={taskId}
                            className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                          >
                            <TagIcon className="w-4 h-4" />
                            {task.title}
                            <button
                              type="button"
                              onClick={() => setSelectedTasks(prev => prev.filter(id => id !== taskId))}
                              className="text-green-600 hover:text-green-800 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Select Tasks Button */}
                  <button
                    type="button"
                    onClick={() => setShowTaskSelectionModal(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {selectedTasks.length > 0 
                          ? `${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} selected`
                          : 'Select tasks to reference...'
                        }
                      </span>
                      <TagIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={createNoteMutation.isPending}
                    className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {createNoteMutation.isPending ? 'Creating...' : 'Create Note'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Note Modal */}
        {showEditModal && editingNote && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Note</h3>
              
              <form onSubmit={handleEditNote} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { value: 'notice', label: 'Notice', color: 'green' },
                      { value: 'issue', label: 'Issue', color: 'yellow' },
                      { value: 'reminder', label: 'Reminder', color: 'blue' },
                      { value: 'important', label: 'Important', color: 'red' },
                      { value: 'other', label: 'Other', color: 'gray' }
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setNoteType(type.value as any)}
                        className={`p-2 text-xs font-medium rounded-lg border transition-colors ${
                          noteType === type.value
                            ? `bg-${type.color}-100 text-${type.color}-800 border-${type.color}-300`
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tag Members (Optional)</label>
                  
                  {/* Tagged Members Display */}
                  {taggedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {taggedMembers.map((member) => (
                        <span
                          key={member._id}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-800 text-sm rounded-full"
                        >
                          <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {member.fullName.charAt(0)}
                          </div>
                          {member.fullName}
                          <button
                            type="button"
                            onClick={() => removeMember(member._id)}
                            className="text-teal-600 hover:text-teal-800 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Member Search */}
                  {project.members && project.members.length > 0 && (
                    <div className="relative">
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search members to tag..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                      />
                      
                      {/* Search Results */}
                      {memberSearch && filteredMembers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                          {filteredMembers.map((member: Member) => (
                            <button
                              key={member.user._id}
                              type="button"
                              onClick={() => addMember(member.user)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                            >
                              <div className="w-6 h-6 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {member.user.fullName.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{member.user.fullName}</div>
                                <div className="text-xs text-gray-500">@{member.user.username}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference Tasks (Optional)</label>
                  
                  {/* Selected Tasks Display */}
                  {selectedTasks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedTasks.map((taskId) => {
                        const task = formattedTasks.find(t => t._id === taskId);
                        if (!task) return null;
                        return (
                          <span
                            key={taskId}
                            className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                          >
                            <TagIcon className="w-4 h-4" />
                            {task.title}
                            <button
                              type="button"
                              onClick={() => setSelectedTasks(prev => prev.filter(id => id !== taskId))}
                              className="text-green-600 hover:text-green-800 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Select Tasks Button */}
                  <button
                    type="button"
                    onClick={() => setShowTaskSelectionModal(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {selectedTasks.length > 0 
                          ? `${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} selected`
                          : 'Select tasks to reference...'
                        }
                      </span>
                      <TagIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={updateNoteMutation.isPending || !hasChanges()}
                    className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={!hasChanges() && !updateNoteMutation.isPending ? 'No changes to save' : ''}
                  >
                    {updateNoteMutation.isPending ? 'Updating...' : 
                     !hasChanges() ? 'No Changes' : 'Update Note'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingNote(null);
                      resetForm();
                    }}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Important Note Confirmation Modal */}
        {showImportantConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center space-x-3 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900">Important Note</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Marking this note as "Important" will notify all project members. Are you sure you want to continue?
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={confirmImportantNote}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Mark as Important
                </button>
                <button
                  onClick={() => {
                    setShowImportantConfirm(false);
                    setPendingNoteData(null);
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Note Confirmation Modal */}
        {showDeleteModal && noteToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Delete Note</h3>
                <button 
                  onClick={cancelDeleteNote}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600">
                  Are you sure you want to delete "<strong>{noteToDelete.title}</strong>"? 
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelDeleteNote}
                  disabled={deleteNoteMutation.isPending}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteNote}
                  disabled={deleteNoteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete Note'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Selection Modal */}
        <TaskSelectionModal
          isOpen={showTaskSelectionModal}
          onClose={() => setShowTaskSelectionModal(false)}
          onSelectTasks={handleTaskSelection}
          tasks={formattedTasks}
          selectedTaskIds={selectedTasks}
        />
      </div>
    </Layout>
  );
};

export default ProjectNotesPage;