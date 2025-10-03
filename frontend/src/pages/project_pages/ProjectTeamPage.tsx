import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useProject } from '../../hooks/useProject';
import { useApiError, ErrorMessage } from '../../hooks/useApiError';
import { useSocket } from '../../contexts/SocketContext';
import { 
  UsersIcon, 
  PlusIcon, 
  TrashIcon, 
  ChevronDownIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  EyeIcon,
  PencilIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface TeamMember {
  user: {
    _id: string;
    fullName: string;
    username: string;
    email: string;
  };
  role: 'viewer' | 'editor' | 'admin';
  joinedAt: string;
}

const ProjectTeamPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const { user: currentUser } = useAuth();
  const { error, handleApiError, clearError } = useApiError();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [friends, setFriends] = useState<any[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { project, isLoading, invalidateProject, updateProjectOptimistically } = useProject(projectId, { enablePolling: true });

  // Get permissions using fresh project data
  const { can, isMember } = usePermissions(project);

  // Auto-select the project in sidebar
  useEffect(() => {
    if (project && (!selectedProject || selectedProject._id !== project._id)) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

  // Fetch friends list
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await api.get('/users/friends');
        setFriends(response.data.friends);
      } catch (error) {
        console.error('Failed to fetch friends:', error);
      }
    };

    fetchFriends();
  }, []);

  // Real-time team updates
  useEffect(() => {
    if (!socket || !projectId) return;

    console.log('🚀 ProjectTeamPage: Setting up socket listeners for project:', projectId);

    // Socket handlers for info updates removed - now using React Query polling
    // Team info will be updated through React Query refetch mechanisms

    const handleProjectDeleted = (data: any) => {
      console.log('🗑️ Project deleted event received:', data);
      if (data.project === projectId || data.projectId === projectId) {
        queryClient.removeQueries({ queryKey: ['project', projectId] });
        toast.error('This project has been deleted');
        window.location.href = '/projects';
      }
    };

    // Join project room for real-time updates
    socket.emit('join_project', projectId);

    // Hybrid approach: Long polling (10min) + instant cache updates via sockets
    socket.on('member_added', () => {
      console.log('👥 Cache invalidation: member_added');
      invalidateProject();
    });
    socket.on('member_removed', () => {
      console.log('👥 Cache invalidation: member_removed');
      invalidateProject();
    });
    socket.on('role_changed', () => {
      console.log('👥 Cache invalidation: role_changed');
      invalidateProject();
    });
    socket.on('project_updated', (data) => {
      // Handle archive events
      if (data.updateType === 'archived') {
        console.log('📦 ProjectTeamPage: Project archived, redirecting with page refresh');
        window.location.href = '/dashboard';
        return;
      }
      
      if (data.type === 'member_added' || data.type === 'member_removed' || data.type === 'role_changed') {
        console.log('👥 Cache invalidation: project_updated -', data.type);
        invalidateProject();
      }
    });
    socket.on('project_deleted', handleProjectDeleted);

    return () => {
      console.log('� ProjectTeamPage: Cleaning up socket listeners');
      // Cache invalidation listeners cleanup
      socket.off('member_added');
      socket.off('member_removed');
      socket.off('role_changed');
      socket.off('project_updated');
      socket.off('project_deleted', handleProjectDeleted);
      socket.emit('leave_project', projectId);
    };
  }, [socket, projectId, invalidateProject]);



  // Check if current user is admin
  const currentUserRole = project?.members?.find(
    (member: TeamMember) => member.user._id === (currentUser as any)?._id
  )?.role;
  const isAdmin = currentUserRole === 'admin' || project?.creator._id === (currentUser as any)?._id;

  // Send invitation mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const response = await api.post(`/projects/${projectId}/invite`, {
        email,
        role
      });
      return response.data;
    },
    onSuccess: () => {
      invalidateProject();
      setShowAddMember(false);
      setMemberEmail('');
      setMemberRole('viewer');
      setShowSuggestions(false);
      toast.success('Invitation sent successfully! The user will be notified.');
    },
    onError: (error: any) => {
      handleApiError(error);
      const message = error.response?.data?.userFriendlyMessage || error.response?.data?.message || 'Failed to send invitation';
      toast.error(message);
    }
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await api.put(`/projects/${projectId}/members/${memberId}/role`, {
        role
      });
      return response.data;
    },
    onMutate: async ({ memberId, role }) => {
      await queryClient.cancelQueries({ queryKey: ['project', projectId] });
      const previousProject = queryClient.getQueryData(['project', projectId]);
      
      updateProjectOptimistically((oldProject: any) => {
        if (!oldProject?.members) return oldProject;
        return {
          ...oldProject,
          members: oldProject.members.map((member: any) => 
            member._id === memberId ? { ...member, role } : member
          )
        };
      });
      
      return { previousProject };
    },
    onSuccess: () => {
      invalidateProject();
      toast.success('Role updated successfully');
    },
    onError: (error: any, _, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(['project', projectId], context.previousProject);
      }
      handleApiError(error);
      const message = error.response?.data?.userFriendlyMessage || error.response?.data?.message || 'Failed to update role';
      toast.error(message);
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await api.delete(`/projects/${projectId}/members/${memberId}`);
      return response.data;
    },
    onSuccess: () => {
      invalidateProject();
      toast.success('Member removed successfully');
    },
    onError: (error: any) => {
      handleApiError(error);
      const message = error.response?.data?.userFriendlyMessage || error.response?.data?.message || 'Failed to remove member';
      toast.error(message);
    }
  });

  // Handle member input change for autocomplete
  const handleMemberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMemberEmail(value);
    
    if (value.length > 0) {
      // First filter friends, excluding the current user
      const filteredFriends = friends.filter(friend => 
        friend._id !== (currentUser as any)?._id && // Exclude current user
        (friend.fullName.toLowerCase().includes(value.toLowerCase()) ||
        friend.username.toLowerCase().includes(value.toLowerCase()) ||
        friend.email.toLowerCase().includes(value.toLowerCase()))
      );

      // Add status information for each friend
      const friendsWithStatus = filteredFriends.map(friend => {
        const isMember = project?.members?.some((member: TeamMember) => 
          member.user._id === friend._id
        );
        const hasPendingInvite = project?.invitations?.some((inv: any) => 
          inv.user._id === friend._id && inv.status === 'pending'
        );

        return {
          ...friend,
          isMember,
          hasPendingInvite,
          status: isMember ? 'member' : hasPendingInvite ? 'pending' : 'available'
        };
      });

      // If input looks like email and no friends match, add it as a non-friend option
      let allSuggestions = [...friendsWithStatus];
      const isEmail = /\S+@\S+\.\S+/.test(value);
      if (isEmail && !friendsWithStatus.some(f => f.email === value)) {
        allSuggestions.push({
          _id: 'non-friend',
          fullName: 'Not in your friends list',
          username: '',
          email: value,
          isMember: false,
          hasPendingInvite: false,
          status: 'non-friend'
        });
      }

      setFilteredSuggestions(allSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Select a user from suggestions
  const selectUser = (user: any) => {
    if (user.status === 'member') {
      toast.error('This user is already a member of the project');
      return;
    }
    if (user.status === 'pending') {
      toast.error('An invitation has already been sent to this user');
      return;
    }
    
    setMemberEmail(user.email);
    setShowSuggestions(false);
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    
    // Check if user is trying to invite themselves
    if (memberEmail.toLowerCase() === (currentUser as any)?.email?.toLowerCase() || 
        memberEmail.toLowerCase() === (currentUser as any)?.username?.toLowerCase()) {
      toast.error('You cannot invite yourself to a project');
      return;
    }
    
    inviteMemberMutation.mutate({ email: memberEmail, role: memberRole });
  };

  const handleUpdateRole = (memberId: string, newRole: string) => {
    updateRoleMutation.mutate({ memberId, role: newRole });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (window.confirm(`Are you sure you want to remove ${memberName} from the project?`)) {
      removeMemberMutation.mutate(memberId);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldCheckIcon className="h-4 w-4 text-red-600" />;
      case 'editor':
        return <PencilIcon className="h-4 w-4 text-blue-600" />;
      case 'viewer':
        return <EyeIcon className="h-4 w-4 text-green-600" />;
      default:
        return <UserCircleIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'editor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

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

  // Check if user has access to view team
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

  if (!can.viewTeam()) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Permission Denied</h1>
          <p className="text-gray-600">You do not have permission to view team information.</p>
        </div>
      </Layout>
    );
  }

  const filteredAndSortedMembers = [...(project.members || [])]
    .filter((member) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        member.user.fullName?.toLowerCase().includes(query) ||
        member.user.username?.toLowerCase().includes(query) ||
        member.user.email?.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const roleOrder: { [key: string]: number } = { admin: 3, editor: 2, viewer: 1 };
      return (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0);
    });

  const sortedMembers = filteredAndSortedMembers;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Error Display */}
        {error && (
          <ErrorMessage error={error} onClose={clearError} />
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <UsersIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600">Team Management & Roles</p>
            </div>
          </div>
          
          {can.addMembers() && (
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Invite Member
            </button>
          )}
        </div>

        {/* Permission Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Role Hierarchy & Permissions</h3>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheckIcon className="h-4 w-4 text-red-600" />
              <span className="font-medium">Admin:</span>
              <span>Full access - manage members, settings, delete project</span>
            </div>
            <div className="flex items-center space-x-2">
              <PencilIcon className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Editor:</span>
              <span>Can modify boards, add issues, create notes, use calendar</span>
            </div>
            <div className="flex items-center space-x-2">
              <EyeIcon className="h-4 w-4 text-green-600" />
              <span className="font-medium">Viewer:</span>
              <span>Read-only access to project details and boards</span>
            </div>
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{sortedMembers.length}</div>
            <div className="text-sm text-gray-600">Active Members</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-red-600">
              {sortedMembers.filter(m => m.role === 'admin').length}
            </div>
            <div className="text-sm text-gray-600">Admins</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">
              {sortedMembers.filter(m => m.role === 'editor').length}
            </div>
            <div className="text-sm text-gray-600">Editors</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">
              {sortedMembers.filter(m => m.role === 'viewer').length}
            </div>
            <div className="text-sm text-gray-600">Viewers</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-yellow-600">
              {project.invitations?.filter((inv: any) => inv.status === 'pending').length || 0}
            </div>
            <div className="text-sm text-gray-600">Pending Invites</div>
          </div>
        </div>

        {/* Team Members List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  placeholder="Search members..."
                />
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {sortedMembers.map((member: TeamMember) => {
                const isProjectCreator = member.user._id === project.creator._id;
                const canManageRole = isAdmin && member.user._id !== (currentUser as any)?._id;
                
                return (
                  <div key={member.user._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-lg">
                          {member.user.fullName?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900">{member.user.fullName}</h3>
                          {isProjectCreator && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                              Creator
                            </span>
                          )}
                          {member.user._id === (currentUser as any)?._id && (
                            <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">@{member.user.username}</p>
                        <p className="text-xs text-gray-500">
                          Joined {new Date(member.joinedAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Role Badge/Selector */}
                      {canManageRole ? (
                        <div className="relative">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.user._id, e.target.value)}
                            disabled={updateRoleMutation.isPending}
                            className={`
                              appearance-none px-3 py-2 pr-8 text-sm font-medium border rounded-lg cursor-pointer
                              ${getRoleBadgeClass(member.role)}
                              focus:outline-none focus:ring-2 focus:ring-teal-500
                            `}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                          <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 pointer-events-none" />
                        </div>
                      ) : (
                        <div className={`
                          flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium
                          ${getRoleBadgeClass(member.role)}
                        `}>
                          {getRoleIcon(member.role)}
                          <span className="capitalize">{member.role}</span>
                        </div>
                      )}
                      
                      {/* Remove Button */}
                      {isAdmin && member.user._id !== (currentUser as any)?._id && !isProjectCreator && (
                        <button
                          onClick={() => handleRemoveMember(member.user._id, member.user.fullName)}
                          disabled={removeMemberMutation.isPending}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove member"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {sortedMembers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <UsersIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No team members found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pending Invitations */}
        {project.invitations && project.invitations.filter((invitation: any) => invitation.status === 'pending').length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pending Invitations</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {project.invitations
                  .filter((invitation: any) => invitation.status === 'pending')
                  .map((invitation: any) => (
                    <div key={invitation._id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {invitation.user?.fullName?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {invitation.user?.fullName || 'Unknown User'}
                          </p>
                          <p className="text-sm text-gray-600">@{invitation.user?.username || 'unknown'}</p>
                          <p className="text-xs text-gray-500">
                            Invited {new Date(invitation.createdAt).toLocaleDateString('en-GB')} • Role: {invitation.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Invite Member Modal */}
        {showAddMember && (
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSuggestions(false);
              }
            }}
          >
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>
              <p className="text-sm text-gray-600 mb-4">
                Send an invitation to join this project. The user will receive a notification and can accept or decline the invitation.
              </p>
              
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address or Friend
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={memberEmail}
                      onChange={handleMemberInputChange}
                      placeholder="Enter email or search friends..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      onFocus={() => memberEmail.length > 0 && setShowSuggestions(true)}
                      required
                    />
                    
                    {/* Suggestions dropdown */}
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {filteredSuggestions.map((suggestion, index) => (
                          <div
                            key={suggestion._id || index}
                            onClick={() => selectUser(suggestion)}
                            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                              suggestion.status === 'member' ? 'opacity-60 cursor-not-allowed' : 
                              suggestion.status === 'pending' ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-teal-800">
                                  {suggestion.fullName?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{suggestion.fullName}</p>
                                <p className="text-xs text-gray-500">
                                  {suggestion.username ? `@${suggestion.username}` : suggestion.email}
                                </p>
                              </div>
                            </div>
                            
                            {/* Status indicator */}
                            <div className="flex items-center">
                              {suggestion.status === 'member' && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                  Already Member
                                </span>
                              )}
                              {suggestion.status === 'pending' && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                  Invite Sent
                                </span>
                              )}
                              {suggestion.status === 'non-friend' && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                                  Not a friend
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as 'viewer' | 'editor' | 'admin')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="viewer">Viewer (Read-only access)</option>
                    <option value="editor">Editor (Can modify content)</option>
                    <option value="admin">Admin (Full access)</option>
                  </select>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={inviteMemberMutation.isPending}
                    className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {inviteMemberMutation.isPending ? 'Sending Invite...' : 'Send Invitation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMember(false);
                      setMemberEmail('');
                      setMemberRole('viewer');
                      setShowSuggestions(false);
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
      </div>
    </Layout>
  );
};

export default ProjectTeamPage;