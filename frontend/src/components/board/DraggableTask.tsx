import React from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useRef, useEffect, useState } from 'react';
import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import type { Task } from '../../hooks/useTask';
import { 
  CalendarIcon, 
  ClockIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface DraggableTaskProps {
  task: Task;
  index: number;
  columnId: string;
  onTaskClick: (task: Task) => void;
  isDisabled?: boolean;
}

export const DraggableTask: React.FC<DraggableTaskProps> = ({
  task,
  index,
  columnId,
  onTaskClick,
  isDisabled = false
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    if (ref.current && !isDisabled) {
      return combine(
        draggable({
          element: ref.current,
          getInitialData: () => ({
            type: 'task',
            taskId: task._id,
            sourceColumnId: columnId,
            index,
          }),
          onDragStart: () => setIsDragging(true),
          onDrop: () => setIsDragging(false),
        }),
        dropTargetForElements({
          element: ref.current,
          canDrop: ({ source }) => {
            // Can only drop other tasks
            return source.data.type === 'task' && source.data.taskId !== task._id;
          },
          getData: ({ input, element }) => {
            const data = {
              type: 'task',
              taskId: task._id,
              columnId: columnId,
              index: index,
            };
            
            return attachClosestEdge(data, {
              input,
              element,
              allowedEdges: ['top', 'bottom'],
            });
          },
          onDragEnter: (args) => {
            setClosestEdge(extractClosestEdge(args.self.data));
          },
          onDrag: (args) => {
            setClosestEdge(extractClosestEdge(args.self.data));
          },
          onDragLeave: () => {
            setClosestEdge(null);
          },
          onDrop: () => {
            setClosestEdge(null);
          },
        })
      );
    }
  }, [task._id, columnId, index, isDisabled]);

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

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className="relative">
      {/* Drop indicator line */}
      {closestEdge === 'top' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
      )}
      {closestEdge === 'bottom' && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
      )}
      
      <div
        ref={ref}
        onClick={() => onTaskClick(task)}
        className={`
          bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm 
          hover:shadow-md transition-all duration-200 cursor-pointer relative
          w-full min-w-0
          ${isDragging ? 'opacity-50 rotate-2 scale-105' : ''}
          ${isDisabled ? 'cursor-not-allowed opacity-75' : 'hover:border-gray-300'}
          ${closestEdge ? 'ring-2 ring-blue-200' : ''}
        `}
      >
      {/* Task Title */}
      <h3 className="font-medium text-gray-900 mb-3 break-words overflow-hidden text-ellipsis line-clamp-2" 
          style={{ 
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
        {task.title}
      </h3>

      {/* Priority Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
          <span className="capitalize">{task.priority}</span>
        </span>
        
        {/* Due Date */}
        {task.dueDate && (
          <div className={`flex items-center space-x-1 text-xs ${
            isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
          }`}>
            {isOverdue ? (
              <ClockIcon className="h-3 w-3 text-red-600" />
            ) : (
              <CalendarIcon className="h-3 w-3" />
            )}
            <span>
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          </div>
        )}
      </div>

      {/* Tagged Members */}
      {task.assignedTo && task.assignedTo.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 min-w-0">
          {task.assignedTo.slice(0, 4).map((user: any) => (
            <span
              key={user._id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-full flex-shrink-0"
              title={user.fullName}
            >
              <div className="w-3 h-3 bg-teal-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {user.fullName.charAt(0)}
              </div>
              <span className="max-w-[50px] truncate">{user.fullName}</span>
            </span>
          ))}
          {task.assignedTo.length > 4 && (
            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full flex-shrink-0">
              +{task.assignedTo.length - 4}
            </span>
          )}
        </div>
      )}

        {/* Creation/Update Date */}
        <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">
          {task.updatedAt && task.updatedAt !== task.createdAt ? (
            <span>Updated {format(new Date(task.updatedAt), 'MMM d, yyyy')}</span>
          ) : (
            <span>Created {format(new Date(task.createdAt), 'MMM d, yyyy')}</span>
          )}
        </div>
      </div>
    </div>
  );
};