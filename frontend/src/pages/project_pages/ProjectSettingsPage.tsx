import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { api } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { useProject, useProjects } from '../../hooks/useProject';
import { getRoleDisplayInfo } from '../../lib/permissions';
import { useSocket } from '../../contexts/SocketContext';
import { 
  CogIcon,
  UserIcon,
  PlusIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  EyeIcon,
  PencilIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const { user } = useAuth(); // Using for authentication context
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState('general');
  
  // State for modals and forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [deleteConfirmation, setDeleteConfirmation] = useState({ projectName: '', password: '' });
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<any[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{memberId: string, newRole: string} | null>(null);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; isCurrentUser: boolean } | null>(null);

  const { project, isLoading, invalidateProject, updateProjectOptimistically } = useProject(projectId, { enablePolling: true });
  const { invalidateProjects } = useProjects({ enablePolling: true });

  // Get permissions using fresh project data
  const { isMember, userRole } = usePermissions(project);

  // Mutations
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const response = await api.post(`/projects/${projectId}/invite`, { email, role });
      return response.data;
    },
    onSuccess: () => {
      invalidateProject();
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('viewer');
      setShowSuggestions(false);
      toast.success('Invitation sent successfully! The user will be notified.');
    },
    onError: (error: any) => {
      const message = error.response?.data?.userFriendlyMessage || error.response?.data?.message || 'Failed to send invitation';
      toast.error(message);
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await api.delete(`/projects/${projectId}/members/${memberId}`);
      return response.data;
    },
    onMutate: async (memberId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['project', projectId] });
      
      // Snapshot the previous value
      const previousProject = queryClient.getQueryData(['project', projectId]);
      
      // Optimistically update the cache
      updateProjectOptimistically((oldProject: any) => {
        if (!oldProject?.members) return oldProject;
        
        return {
          ...oldProject,
          members: oldProject.members.filter((member: any) => member._id !== memberId)
        };
      });
      
      return { previousProject };
    },
    onError: (error, __, context) => {
      // Rollback on error
      if (context?.previousProject) {
        queryClient.setQueryData(['project', projectId], context.previousProject);
      }
      toast.error((error as any).response?.data?.message || 'Failed to remove member');
    },
    onSuccess: (data) => {
      invalidateProject();
      invalidateProjects();
      
      // Check if the removed member was the current user
      const wasCurrentUser = memberToRemove?.isCurrentUser;
      
      // Use the message from backend response
      toast.success(data.message);
      
      if (wasCurrentUser) {
        // Navigate to projects page since user is no longer a member
        navigate('/projects');
      }
    }
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await api.put(`/projects/${projectId}/members/${memberId}/role`, { role });
      return response.data;
    },
    onMutate: async ({ memberId, role }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['project', projectId] });
      
      // Snapshot the previous value
      const previousProject = queryClient.getQueryData(['project', projectId]);
      
      // Optimistically update the cache
      updateProjectOptimistically((oldProject: any) => {
        if (!oldProject?.members) return oldProject;
        
        return {
          ...oldProject,
          members: oldProject.members.map((member: any) => 
            member._id === memberId ? { ...member, role } : member
          )
        };
      });
      
      // Return a context object with the snapshotted value
      return { previousProject };
    },
    onError: (error, __, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProject) {
        queryClient.setQueryData(['project', projectId], context.previousProject);
      }
      toast.error((error as any).response?.data?.message || 'Failed to update member role');
    },
    onSuccess: async () => {
      // Invalidate project and projects list
      invalidateProject();
      invalidateProjects();
      
      // Invalidate all project-specific queries (tasks, notes, etc.)
      await queryClient.invalidateQueries({ queryKey: ['project', projectId, 'tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['project', projectId, 'notes'] });
      await queryClient.invalidateQueries({ queryKey: ['project', projectId, 'members'] });
      
      // Update sidebar selected project with fresh data after invalidation
      setTimeout(async () => {
        const freshProject = queryClient.getQueryData(['project', projectId]) as any;
        if (freshProject && freshProject._id) {
          setSelectedProject(freshProject);
        }
      }, 100); // Small delay to allow cache to update
      
      toast.success('Member role updated successfully');
    }
  });

  const archiveProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/projects/${projectId}/archive`, {
        notifyMembers: true,
        action: 'archived'
      });
      return response.data;
    },
    onSuccess: () => {
      invalidateProjects();
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      
      // Navigate immediately - socket event will handle redirect and notification
      navigate('/projects');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to archive project');
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async ({ projectName, password }: { projectName: string; password: string }) => {
      const response = await api.delete(`/projects/${projectId}`, {
        data: { 
          projectName, 
          password,
          notifyMembers: true,
          action: 'deleted'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      invalidateProjects();
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      
      toast.success('Project deleted successfully. All members have been notified.');
      navigate('/projects');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete project');
    }
  });

  // Handle member input change for autocomplete
  const handleMemberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteEmail(value);
    
    if (value.length > 0) {
      // First filter friends, excluding the current user
      const filteredFriends = friends.filter(friend => 
        friend._id !== user?.id && // Exclude current user
        (friend.fullName.toLowerCase().includes(value.toLowerCase()) ||
        friend.username.toLowerCase().includes(value.toLowerCase()) ||
        friend.email.toLowerCase().includes(value.toLowerCase()))
      );

      // Add status information for each friend
      const friendsWithStatus = filteredFriends.map(friend => {
        const isMember = project?.members?.some((member: any) => 
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
    
    setInviteEmail(user.email);
    setShowSuggestions(false);
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    
    // Check if user is trying to invite themselves
    if (inviteEmail.toLowerCase() === user?.email?.toLowerCase() || 
        inviteEmail.toLowerCase() === user?.username?.toLowerCase()) {
      toast.error('You cannot invite yourself to a project');
      return;
    }
    
    inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    const currentUserMember = project?.members?.find((m: any) => m.user._id === user?.id);
    const isCurrentUser = memberId === currentUserMember?._id;
    const isCurrentUserAdmin = currentUserMember?.role === 'admin';
    const isCreator = project?.creator?._id === user?.id;
    
    // Prevent creator from demoting themselves
    if (isCurrentUser && isCreator && newRole !== 'admin') {
      toast.error('Project creators cannot demote themselves. You must always remain as admin.');
      return;
    }
    
    // If current user is demoting themselves from admin, show confirmation
    if (isCurrentUser && isCurrentUserAdmin && newRole !== 'admin') {
      setPendingRoleChange({ memberId, newRole });
      setShowRoleChangeModal(true);
    } else {
      // Proceed with role change
      updateMemberRoleMutation.mutate({ memberId, role: newRole });
    }
  };

  const confirmRoleChange = () => {
    if (pendingRoleChange) {
      updateMemberRoleMutation.mutate({
        memberId: pendingRoleChange.memberId,
        role: pendingRoleChange.newRole
      });
      setPendingRoleChange(null);
      setShowRoleChangeModal(false);
    }
  };

  const handleRemoveMember = (member: any) => {
    const isCurrentUser = member.user._id === user?.id;
    setMemberToRemove({
      id: member._id,
      name: member.user?.fullName || member.user?.username,
      isCurrentUser
    });
    setShowRemoveMemberModal(true);
  };

  const confirmRemoveMember = () => {
    if (memberToRemove) {
      removeMemberMutation.mutate(memberToRemove.id);
      setMemberToRemove(null);
      setShowRemoveMemberModal(false);
    }
  };

  const handleLeaveProject = () => {
    // Find current user's membership
    const currentUserMember = project?.members?.find((m: any) => m.user._id === user?.id);
    if (currentUserMember) {
      setMemberToRemove({
        id: currentUserMember._id,
        name: user?.fullName || user?.username || 'You',
        isCurrentUser: true
      });
      setShowRemoveMemberModal(true);
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

  // Auto-select the project in sidebar when viewing it
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

  // Join/leave project room for real-time updates (global listeners handle cache invalidation)
  useEffect(() => {
    if (!socket || !projectId) return;



    // Handle archive events
    const handleProjectUpdated = (data: any) => {
      if (data.updateType === 'archived') {

        window.location.href = '/dashboard';
      }
    };

    const handleProjectDeleted = (data: any) => {
      if (data.project === projectId || data.projectId === projectId) {

        window.location.href = '/dashboard';
      }
    };

    // Join project room for real-time updates
    socket.emit('join_project', projectId);

    // Register event listeners
    socket.on('project_updated', handleProjectUpdated);
    socket.on('project_deleted', handleProjectDeleted);

    return () => {

      socket.off('project_updated', handleProjectUpdated);
      socket.off('project_deleted', handleProjectDeleted);
      socket.emit('leave_project', projectId);
    };
  }, [socket, projectId]);

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

  // Check if user has admin access
  // Check if user can manage settings (using can.editProjectInfo internally in components)

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'members', name: 'Team & Permissions', icon: UserIcon },
    { id: 'advanced', name: 'Advanced', icon: ExclamationTriangleIcon }
  ];

  const renderGeneralSettings = () => {
    const isProjectOwner = project && user && project.creator._id === user.id;
    
    return (
      <div className="space-y-6">
        {/* Project Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Project Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <p className="text-sm text-gray-900">{project?.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-sm text-gray-900">{project?.description || 'No description provided'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
              <p className="text-sm text-gray-900">{project?.creator?.fullName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Role</label>
              <p className="text-sm text-gray-900">{userRole ? getRoleDisplayInfo(userRole).label : 'Unknown'}</p>
            </div>
          </div>
        </div>

        {/* Leave Project Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Leave Project</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 mb-1">Leave this project</p>
              <p className="text-sm text-gray-600">
                {isProjectOwner 
                  ? 'Project owners cannot leave their own projects. You must transfer ownership or delete the project instead.'
                  : 'You will lose access to all project data and will need to be re-invited to rejoin.'
                }
              </p>
            </div>
            <button
              onClick={handleLeaveProject}
              disabled={removeMemberMutation.isPending || isProjectOwner}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isProjectOwner 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
              }`}
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span>Leave Project</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMembersSettings = () => {
    const isAdmin = userRole === 'admin';
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
            {isAdmin && (
              <button 
                onClick={() => setShowInviteModal(true)}
                disabled={!isAdmin}
                className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Invite Members
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {project.members?.map((member: any) => {
              const isExpanded = expandedMembers.has(member._id);
              const isCreator = member.user?._id === project.creator._id;
              
              return (
                <div key={member._id} className={`border rounded-lg ${isAdmin ? '' : 'opacity-75'}`}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {member.user?.fullName?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">
                            {member.user?.fullName || 'Unknown User'}
                          </p>
                          {isCreator && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              Creator
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">@{member.user?.username || 'unknown'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Role Badge/Selector */}
                      {(isAdmin && !isCreator) || (member.user._id === user?.id && member.role === 'admin' && member.user._id !== project?.creator?._id) ? (
                        <div className="relative">
                          <select
                            value={member.role}
                            onChange={(e) => {
                              handleRoleChange(member._id, e.target.value);
                            }}
                            disabled={updateMemberRoleMutation.isPending}
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
                      
                      {isAdmin && !isCreator && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedMembers);
                            if (isExpanded) {
                              newExpanded.delete(member._id);
                            } else {
                              newExpanded.add(member._id);
                            }
                            setExpandedMembers(newExpanded);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && isAdmin && !isCreator && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <div className="pt-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRemoveMember(member)}
                            disabled={removeMemberMutation.isPending}
                            className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1 inline" />
                            {member.user._id === user?.id ? 'Leave Project' : 'Remove Member'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {!isAdmin && (
            <p className="text-sm text-gray-500 mt-4">
              You need admin permissions to manage team members.
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          {[
            { name: 'Task Updates', description: 'Get notified when tasks are created, updated, or completed' },
            { name: 'Project Changes', description: 'Notifications about project settings and information changes' },
            { name: 'Team Activity', description: 'Updates about new members joining or leaving the project' },
            { name: 'Deadline Reminders', description: 'Reminders about upcoming task deadlines' },
          ].map((setting) => (
            <div key={setting.name} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{setting.name}</p>
                <p className="text-sm text-gray-500">{setting.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Visibility</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
            <LockClosedIcon className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">Private Project</p>
              <p className="text-sm text-gray-500">Only invited members can access this project</p>
            </div>
            <input type="radio" name="visibility" defaultChecked className="ml-auto" />
          </div>
          <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg opacity-50">
            <GlobeAltIcon className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">Public Project</p>
              <p className="text-sm text-gray-500">Anyone in your organization can view this project</p>
            </div>
            <input type="radio" name="visibility" disabled className="ml-auto" />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          🚀 Public projects coming soon! Currently all projects are private by default.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Require approval for new members</p>
              <p className="text-sm text-gray-500">New member requests need admin approval</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => {
    const isAdmin = userRole === 'admin';
    
    return (
      <div className="space-y-6">
        {isAdmin ? (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <ArchiveBoxIcon className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-semibold text-gray-900">Archive Project</h3>
              </div>
              <div>
                <p className="text-gray-900 mb-4">
                  Archive this project to make it read-only. Archived projects can be restored later.
                </p>
                <button 
                  onClick={() => setShowArchiveModal(true)}
                  disabled={archiveProjectMutation.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {archiveProjectMutation.isPending ? 'Archiving...' : 'Archive Project'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
              <div className="space-y-4">
                <div className="border-t border-red-200 pt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <TrashIcon className="h-5 w-5 text-red-600" />
                    <h4 className="text-lg font-semibold text-red-900">Delete Project</h4>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                    <p className="text-red-800 font-medium">
                      ⚠️ Warning: Once you delete a project, there is no going back. Please be certain.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDeleteModal(true)}
                    disabled={deleteProjectMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-8">
              <KeyIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Admin Access Required</h3>
              <p className="text-gray-600">
                You need admin permissions to access advanced project settings.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'members':
        return renderMembersSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'privacy':
        return renderPrivacySettings();
      case 'advanced':
        return renderAdvancedSettings();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <CogIcon className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project Settings</h1>
              <p className="text-gray-600">
                Manage settings and preferences for {project.name}
                {userRole && (
                  <span className="ml-2 text-sm">
                    (You have {getRoleDisplayInfo(userRole).label} access)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSuggestions(false);
              }
            }}
          >
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
                <button 
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteRole('viewer');
                    setShowSuggestions(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
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
                      value={inviteEmail}
                      onChange={handleMemberInputChange}
                      placeholder="Enter email or search friends..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      onFocus={() => inviteEmail.length > 0 && setShowSuggestions(true)}
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
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor' | 'admin')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="viewer">Viewer (Read-only access)</option>
                    <option value="editor">Editor (Can modify content)</option>
                    <option value="admin">Admin (Full access)</option>
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteRole('viewer');
                      setShowSuggestions(false);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteMemberMutation.isPending}
                    className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {inviteMemberMutation.isPending ? 'Sending Invite...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Archive Confirmation Modal */}
        {showArchiveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Archive Project</h3>
                <button 
                  onClick={() => setShowArchiveModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600">
                  Are you sure you want to archive "<strong>{project?.name}</strong>"? 
                  The project will be hidden from your dashboard but can be restored later.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    archiveProjectMutation.mutate();
                    setShowArchiveModal(false);
                  }}
                  disabled={archiveProjectMutation.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {archiveProjectMutation.isPending ? 'Archiving...' : 'Archive Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-900">Delete Project</h3>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation({ projectName: '', password: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  This action cannot be undone. This will permanently delete the project 
                  "<strong>{project?.name}</strong>" and all associated data.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type the project name "{project?.name}" to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation.projectName}
                      onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, projectName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter your password to confirm:
                    </label>
                    <input
                      type="password"
                      value={deleteConfirmation.password}
                      onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation({ projectName: '', password: '' });
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteProjectMutation.mutate({
                      projectName: deleteConfirmation.projectName,
                      password: deleteConfirmation.password
                    });
                  }}
                  disabled={
                    deleteConfirmation.projectName !== project?.name || 
                    !deleteConfirmation.password || 
                    deleteProjectMutation.isPending
                  }
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteProjectMutation.isPending ? 'Deleting...' : 'I understand, delete this project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Role Change Confirmation Modal */}
        {showRoleChangeModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Confirm Role Change</h3>
                <button 
                  onClick={() => {
                    setShowRoleChangeModal(false);
                    setPendingRoleChange(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="font-medium text-gray-900">Warning: You are about to demote yourself</p>
                  </div>
                </div>
                <p className="text-gray-600">
                  You are changing your role from <strong>Admin</strong> to <strong className="capitalize">{pendingRoleChange?.newRole}</strong>. 
                </p>
                <p className="text-gray-600 mt-2">
                  <strong>Important:</strong> You will not be able to revert this change unless another admin promotes you back to admin status.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRoleChangeModal(false);
                    setPendingRoleChange(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRoleChange}
                  disabled={updateMemberRoleMutation.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {updateMemberRoleMutation.isPending ? 'Updating...' : 'Confirm Change'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Member Confirmation Modal */}
        {showRemoveMemberModal && memberToRemove && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {memberToRemove.isCurrentUser ? 'Leave Project' : 'Remove Member'}
                </h3>
                <button 
                  onClick={() => {
                    setShowRemoveMemberModal(false);
                    setMemberToRemove(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {memberToRemove.isCurrentUser ? 'Confirm Leave Project' : 'Confirm Remove Member'}
                    </p>
                  </div>
                </div>
                <p className="text-gray-600">
                  {memberToRemove.isCurrentUser 
                    ? 'Are you sure you want to leave this project? You will lose access to all project data and will need to be re-invited to rejoin.'
                    : `Are you sure you want to remove ${memberToRemove.name} from this project? They will lose access to all project data.`
                  }
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRemoveMemberModal(false);
                    setMemberToRemove(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveMember}
                  disabled={removeMemberMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {removeMemberMutation.isPending ? 'Removing...' : (memberToRemove.isCurrentUser ? 'Leave Project' : 'Remove Member')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectSettingsPage;