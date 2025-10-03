import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CreateTaskData } from '../../hooks/useTask';
import { TASK_COLUMNS } from '../../constants';
import type { TaskColumn } from '../../constants';

type ColumnType = TaskColumn;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: CreateTaskData) => void;
  initialColumn?: ColumnType;
  isLoading?: boolean;
  projectMembers?: Array<{
    _id: string;
    user: {
      _id: string;
      fullName: string;
      username: string;
    };
  }>;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialColumn = TASK_COLUMNS.TODO,
  isLoading = false,
  projectMembers = []
}) => {
  const [formData, setFormData] = useState<CreateTaskData>({
    title: '',
    description: '',
    column: initialColumn,
    priority: 'low',
    assignedTo: [],
    dueDate: ''
  });

  const [memberSearch, setMemberSearch] = useState('');
  const [taggedMembers, setTaggedMembers] = useState<Array<{_id: string; fullName: string; username: string}>>([]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        column: initialColumn,
        priority: 'low',
        assignedTo: [],
        dueDate: ''
      });
      setMemberSearch('');
      setTaggedMembers([]);
    }
  }, [isOpen, initialColumn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    onSubmit({
      ...formData,
      title: formData.title.trim(),
      description: formData.description?.trim() || undefined,
      dueDate: formData.dueDate?.trim() || undefined,
      assignedTo: taggedMembers.map(member => member._id)
    });
  };



  const addMember = (member: {_id: string; fullName: string; username: string}) => {
    if (!taggedMembers.find(m => m._id === member._id)) {
      const newTaggedMembers = [...taggedMembers, member];
      setTaggedMembers(newTaggedMembers);
      setFormData(prev => ({
        ...prev,
        assignedTo: newTaggedMembers.map(m => m._id)
      }));
    }
    setMemberSearch('');
  };

  const removeMember = (memberId: string) => {
    const newTaggedMembers = taggedMembers.filter(m => m._id !== memberId);
    setTaggedMembers(newTaggedMembers);
    setFormData(prev => ({
      ...prev,
      assignedTo: newTaggedMembers.map(m => m._id)
    }));
  };

  const filteredMembers = projectMembers.filter(member => {
    const searchLower = memberSearch.toLowerCase();
    const alreadyTagged = taggedMembers.some(tagged => tagged._id === member.user._id);
    return !alreadyTagged && (
      member.user.fullName.toLowerCase().includes(searchLower) ||
      member.user.username.toLowerCase().includes(searchLower)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              placeholder="Enter task title..."
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter task description..."
            />
          </div>

          {/* Column and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Column
              </label>
              <select
                value={formData.column}
                onChange={(e) => setFormData(prev => ({ ...prev, column: e.target.value as ColumnType }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors bg-white appearance-none cursor-pointer"
              >
                <option value={TASK_COLUMNS.TODO} style={{backgroundColor: '#f9fafb', color: '#374151'}}>To Do</option>
                <option value={TASK_COLUMNS.DOING} style={{backgroundColor: '#eff6ff', color: '#1d4ed8'}}>Doing</option>
                <option value={TASK_COLUMNS.DONE} style={{backgroundColor: '#f0fdf4', color: '#166534'}}>Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors bg-white appearance-none cursor-pointer"
              >
                <option value="low" style={{backgroundColor: '#f0fdf4', color: '#166534'}}>🟢 Low</option>
                <option value="medium" style={{backgroundColor: '#fefce8', color: '#a16207'}}>🟡 Medium</option>
                <option value="high" style={{backgroundColor: '#fff7ed', color: '#c2410c'}}>🔴 High</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={formData.dueDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors cursor-pointer"
              />
              {formData.dueDate && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, dueDate: '' }))}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
                  title="Clear due date"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Tag Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag Members
            </label>
            
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
            {projectMembers.length > 0 && (
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
                    {filteredMembers.map((member) => (
                      <button
                        key={member._id}
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



          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};