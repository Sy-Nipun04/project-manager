import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import type { Task } from '../../hooks/useTask';
import { format } from 'date-fns';

interface DashboardTaskCardProps {
  task: Task & { project?: { _id: string; name: string } };
  showProject?: boolean;
}

export const DashboardTaskCard: React.FC<DashboardTaskCardProps> = ({ 
  task, 
  showProject = true 
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {

      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
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
        return 'bg-gray-50 border-l-gray-400';
      case 'doing':
        return 'bg-blue-50 border-l-blue-400';
      case 'done':
        return 'bg-green-50 border-l-green-400';
      default:
        return 'bg-gray-50 border-l-gray-400';
    }
  };

  const getColumnText = (column: string) => {
    switch (column) {
      case 'todo':
        return 'To Do';
      case 'doing':
        return 'In Progress';
      case 'done':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className={`p-4 rounded-lg border-l-4 transition-all duration-200 hover:shadow-sm ${getColumnColor(task.column)}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className={`font-medium text-gray-900 ${task.column === 'done' ? 'line-through' : ''}`}>
          {task.title}
        </h3>
        {task.column === 'done' && (
          <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
        )}
      </div>

      {/* Project name */}
      {showProject && task.project && (
        <p className="text-sm text-gray-600 mb-2">
          From <span className="font-medium">{task.project.name}</span>
        </p>
      )}

      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 2).map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              <TagIcon className="h-2 w-2" />
              <span>{tag}</span>
            </span>
          ))}
          {task.tags.length > 2 && (
            <span className="text-xs text-gray-500 px-2 py-1">
              +{task.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Task meta info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-3">
          {/* Status badge */}
          <span className="px-2 py-1 bg-white rounded-full text-gray-700 font-medium">
            {getColumnText(task.column)}
          </span>

          {/* Priority badge */}
          {task.priority === 'high' && (
            <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
              <ExclamationTriangleIcon className="h-3 w-3" />
              <span className="capitalize">{task.priority}</span>
            </span>
          )}

          {/* Assignees count */}
          {task.assignedTo && task.assignedTo.length > 0 && (
            <div className="flex items-center space-x-1">
              <UserIcon className="h-3 w-3" />
              <span>{task.assignedTo.length}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Due date */}
          {task.dueDate && (
            <div className={`flex items-center space-x-1 ${isOverdue ? 'text-red-600' : ''}`}>
              {isOverdue ? (
                <ClockIcon className="h-3 w-3 text-red-600" />
              ) : (
                <CalendarIcon className="h-3 w-3" />
              )}
              <span className={isOverdue ? 'font-medium' : ''}>
                {task.column === 'done' ? 'Completed' : format(new Date(task.dueDate), 'MMM d')}
              </span>
            </div>
          )}

          {/* Project link */}
          {task.project && (
            <Link
              to={`/project/${task.project._id}/board`}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              View Board
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};