import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  UserPlusIcon, 
  UserIcon, 
  MagnifyingGlassIcon, 
  CheckIcon, 
  XMarkIcon,
  ClockIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

interface User {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  profileImage?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface FriendRequest {
  _id: string;
  user: User;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

const SocialPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<User | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
  }, []);

  useEffect(() => {
    // Refresh friend requests when switching to requests tab
    if (activeTab === 'requests') {
      fetchFriendRequests();
    }
  }, [activeTab]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/friends');
      setFriends(response.data.friends);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch friends');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await api.get('/users/friend-requests');
      setFriendRequests(response.data.friendRequests);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch friend requests');
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
      setSearchResults(response.data.users);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      // Find the user to get their name for the toast
      const user = searchResults.find(u => u._id === userId);
      
      await api.post('/users/friend-request', { userId });
      setError(null);
      
      // Show success toast
      toast.success(`Friend request sent to ${user?.fullName || 'user'}!`);
      
      // Add user to sent requests set
      setSentRequests(prev => new Set([...prev, userId]));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send friend request');
      toast.error(err.response?.data?.message || 'Failed to send friend request');
    }
  };

  const respondToFriendRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      // Find the friend request to get the user's name for the toast
      const friendRequest = friendRequests.find(req => req._id === requestId);
      const userName = friendRequest?.user.fullName || 'user';
      
      await api.put(`/users/friend-request/${requestId}`, { action });
      setError(null);
      
      // Show success toast
      if (action === 'accept') {
        toast.success(`You are now friends with ${userName}!`);
      } else {
        toast.success(`Friend request from ${userName} declined`);
      }
      
      // Remove from friend requests
      setFriendRequests(prev => prev.filter(req => req._id !== requestId));
      
      // Handle request response
      const processedRequest = friendRequests.find(req => req._id === requestId);
      if (processedRequest) {
        // Remove from sent requests regardless of action (accept/decline)
        setSentRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(processedRequest.user._id);
          return newSet;
        });
      }
      
      // If accepted, refresh friends list
      if (action === 'accept') {
        await fetchFriends();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || `Failed to ${action} friend request`;
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const removeFriend = (friend: User) => {
    setFriendToRemove(friend);
    setShowRemoveModal(true);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;

    try {
      await api.delete(`/users/friends/${friendToRemove._id}`);
      setError(null);
      setFriends(prev => prev.filter(friend => friend._id !== friendToRemove._id));
      toast.success(`Removed ${friendToRemove.fullName} from your friends`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove friend');
      toast.error('Failed to remove friend');
    } finally {
      setShowRemoveModal(false);
      setFriendToRemove(null);
    }
  };

  const cancelRemoveFriend = () => {
    setShowRemoveModal(false);
    setFriendToRemove(null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    searchUsers(value);
  };

  const isUserAlreadyFriend = (userId: string) => {
    return friends.some(friend => friend._id === userId);
  };

  const hasPendingRequest = (userId: string) => {
    // Check for incoming requests (requests sent to current user)
    const hasIncomingRequest = friendRequests.some(req => req.user._id === userId && req.status === 'pending');
    // Check for outgoing requests (requests sent by current user)
    const hasOutgoingRequest = sentRequests.has(userId);
    
    return hasIncomingRequest || hasOutgoingRequest;
  };

  const getOnlineStatus = (user: User) => {
    if (user.isOnline) {
      return <span className="text-green-600 text-sm">Online</span>;
    } else if (user.lastSeen) {
      const lastSeen = new Date(user.lastSeen);
      const now = new Date();
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 1) {
        return <span className="text-gray-500 text-sm">Last seen just now</span>;
      } else if (diffHours < 24) {
        return <span className="text-gray-500 text-sm">Last seen {diffHours}h ago</span>;
      } else {
        return <span className="text-gray-500 text-sm">Last seen {diffDays}d ago</span>;
      }
    }
    return <span className="text-gray-500 text-sm">Offline</span>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams & Friends</h1>
          <p className="text-gray-600">Connect with colleagues and manage your professional network</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('friends')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'friends'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserGroupIcon className="h-5 w-5 inline mr-2" />
              Friends ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'search'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MagnifyingGlassIcon className="h-5 w-5 inline mr-2" />
              Find People
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 px-1 border-b-2 font-medium text-sm relative ${
                activeTab === 'requests'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ClockIcon className="h-5 w-5 inline mr-2" />
              Requests
              {friendRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Friends</h2>
              
              {/* Friends Search Bar */}
              {friends.length > 0 && (
                <div className="mb-6">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={friendsSearchQuery}
                      onChange={(e) => setFriendsSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading friends...</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8">
                  <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Friends Yet</h3>
                  <p className="text-gray-600 mb-4">Start building your professional network by finding colleagues.</p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                    Find People
                  </button>
                </div>
              ) : (
                (() => {
                  const filteredFriends = friends.filter(friend =>
                    friend.fullName.toLowerCase().includes(friendsSearchQuery.toLowerCase()) ||
                    friend.username.toLowerCase().includes(friendsSearchQuery.toLowerCase()) ||
                    friend.email.toLowerCase().includes(friendsSearchQuery.toLowerCase())
                  );

                  if (filteredFriends.length === 0 && friendsSearchQuery) {
                    return (
                      <div className="text-center py-8">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Friends Found</h3>
                        <p className="text-gray-600">No friends match your search criteria. Try a different search term.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredFriends.map((friend) => (
                    <div key={friend._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                            {friend.profileImage ? (
                              <img
                                src={friend.profileImage}
                                alt={friend.fullName}
                                className="h-12 w-12 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-medium text-teal-800">
                                {friend.fullName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{friend.fullName}</p>
                          <p className="text-sm text-gray-500 truncate">@{friend.username}</p>
                          {getOnlineStatus(friend)}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-between">
                        <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                          Message
                        </button>
                        <button
                          onClick={() => removeFriend(friend)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Find People</h2>
              
              <div className="mb-6">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search by name, username, or email..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              {searchLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Searching...</p>
                </div>
              ) : searchQuery.length >= 2 ? (
                searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No users found matching "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchResults.map((user) => (
                      <div key={user._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                              {user.profileImage ? (
                                <img
                                  src={user.profileImage}
                                  alt={user.fullName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-medium text-teal-800">
                                  {user.fullName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          {isUserAlreadyFriend(user._id) ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckIcon className="h-3 w-3 mr-1" />
                              Friends
                            </span>
                          ) : hasPendingRequest(user._id) ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <ClockIcon className="h-3 w-3 mr-1" />
                              {sentRequests.has(user._id) ? 'Request Sent' : 'Pending'}
                            </span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(user._id)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                            >
                              <UserPlusIcon className="h-3 w-3 mr-1" />
                              Add Friend
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-8">
                  <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Enter at least 2 characters to search for people</p>
                </div>
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Friend Requests</h2>
              
              {friendRequests.length === 0 ? (
                <div className="text-center py-8">
                  <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No pending friend requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {friendRequests.map((request) => (
                    <div key={request._id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                            {request.user.profileImage ? (
                              <img
                                src={request.user.profileImage}
                                alt={request.user.fullName}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-medium text-teal-800">
                                {request.user.fullName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{request.user.fullName}</p>
                          <p className="text-sm text-gray-500">@{request.user.username}</p>
                          <p className="text-xs text-gray-400">
                            Sent {new Date(request.createdAt).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => respondToFriendRequest(request._id, 'accept')}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                        >
                          <CheckIcon className="h-3 w-3 mr-1" />
                          Accept
                        </button>
                        <button
                          onClick={() => respondToFriendRequest(request._id, 'decline')}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                          <XMarkIcon className="h-3 w-3 mr-1" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Remove Friend Confirmation Modal */}
      {showRemoveModal && friendToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Remove Friend</h3>
              <button 
                onClick={cancelRemoveFriend}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600">
                Are you sure you want to remove <span className="font-medium">{friendToRemove.fullName}</span> from your friends? 
                This action cannot be undone.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelRemoveFriend}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFriend}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Remove Friend
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SocialPage;