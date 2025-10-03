import React, { useState } from 'react';
import { 
  XMarkIcon, 
  PencilIcon, 
  TrashIcon, 
  CalendarIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import type { Task } from '../../hooks/useTask';
import { format } from 'date-fns';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAddComment?: (taskId: string, content: string) => void;
  canEdit?: boolean;
  isDeleting?: boolean;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onAddComment,
  canEdit = false,
  isDeleting = false
}) => {
  const [comment, setComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  if (!isOpen || !task) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getColumnColor = (column: string) => {
    switch (column) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'doing':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !onAddComment) return;
    
    setIsAddingComment(true);
    try {
      await onAddComment(task._id, comment.trim());
      setComment('');
    } finally {
      setIsAddingComment(false);
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 line-clamp-2 break-words pr-2">
              {task.title}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {canEdit && (
              <>
                <button
                  onClick={() => onEdit(task)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit task"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(task._id)}
                  disabled={isDeleting}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Delete task"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and Priority */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getColumnColor(task.column)}`}>
              {task.column === 'todo' && 'To Do'}
              {task.column === 'doing' && 'In Progress'}
              {task.column === 'done' && 'Completed'}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(task.priority)}`}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
            </span>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3 border">
                <p className="text-gray-900 whitespace-pre-wrap break-words">{task.description}</p>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            {task.dueDate && (
              <div className="flex items-center space-x-2">
                <CalendarIcon className={`h-4 w-4 ${isOverdue ? 'text-red-600' : 'text-gray-400'}`} />
                <span className="text-sm text-gray-600">Due Date:</span>
                <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {format(new Date(task.dueDate), 'MMM d, yyyy')}
                  {isOverdue && ' (Overdue)'}
                </span>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center space-x-2">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Created:</span>
              <span className="text-sm text-gray-900">
                {format(new Date(task.createdAt), 'MMM d, yyyy')}
              </span>
            </div>

            {/* Created By */}
            <div className="flex items-center space-x-2">
              <UserIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Created by:</span>
              <span className="text-sm text-gray-900">{task.createdBy?.fullName || 'Unknown User'}</span>
            </div>

            {/* Tagged Members */}
            {task.assignedTo && task.assignedTo.length > 0 && (
              <div className="col-span-2">
                <div className="flex items-start space-x-2">
                  <UserIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-sm text-gray-600 block mb-2">Tagged:</span>
                    <div className="flex flex-wrap gap-2">
                      {task.assignedTo.map((user) => (
                        <div
                          key={user._id}
                          className="inline-flex items-center space-x-2 px-2 py-1 bg-teal-50 text-teal-700 rounded-md border border-teal-200"
                        >
                          <div className="w-5 h-5 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                            {user.fullName?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium">{user.fullName || 'Unknown User'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    <TagIcon className="h-3 w-3" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Comments ({task.comments?.length || 0})
            </h3>

            {/* Add Comment */}
            {onAddComment && (
              <div className="mb-4">
                <div className="flex space-x-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!comment.trim() || isAddingComment}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-3">
              {task.comments && task.comments.length > 0 ? (
                task.comments.map((comment) => (
                  <div key={comment._id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs">
                        {comment.user.fullName?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {comment.user.fullName || 'Unknown User'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap ml-8">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No comments yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};