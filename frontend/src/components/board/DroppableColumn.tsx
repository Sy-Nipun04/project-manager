import React from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useRef, useEffect, useState } from 'react';
import type { Task } from '../../hooks/useTask';
import { DraggableTask } from './DraggableTask';
import { PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type ColumnType = 'todo' | 'doing' | 'done';

interface DroppableColumnProps {
  columnId: ColumnType;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCreateTask: (column: ColumnType) => void;
  isDisabled?: boolean;
  doingLimit?: number;
}

export const DroppableColumn: React.FC<DroppableColumnProps> = ({
  columnId,
  title,
  tasks,
  onTaskClick,
  onCreateTask,
  isDisabled = false,
  doingLimit
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  useEffect(() => {
    if (ref.current) {
      return dropTargetForElements({
        element: ref.current,
        canDrop: ({ source }) => {
          return source.data.type === 'task';
        },
        getData: () => ({ 
          type: 'column',
          columnId,
        }),
        onDragEnter: () => setIsDropTarget(true),
        onDragLeave: () => setIsDropTarget(false),
        onDrop: () => setIsDropTarget(false),
      });
    }
  }, [columnId]);

  const getColumnStyles = () => {
    const baseStyles = 'w-80 min-h-[500px] bg-gray-50 rounded-lg border-2 border-dashed transition-all duration-200 flex-shrink-0';
    
    if (isDropTarget) {
      return `${baseStyles} border-blue-400 bg-blue-50`;
    }
    
    return `${baseStyles} border-gray-200`;
  };

  const getHeaderColor = () => {
    switch (columnId) {
      case 'todo':
        return 'text-gray-700 bg-gray-100';
      case 'doing':
        return 'text-blue-700 bg-blue-100';
      case 'done':
        return 'text-green-700 bg-green-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const isOverLimit = Boolean(doingLimit && columnId === 'doing' && tasks.length >= doingLimit);

  return (
    <div className={getColumnStyles()}>
      {/* Column Header */}
      <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getHeaderColor()}`}>
              {title}
            </span>
            <span className="text-sm text-gray-500">
              ({tasks.length})
            </span>
          </div>
          
          {!isDisabled && (
            <button
              onClick={() => onCreateTask(columnId)}
              disabled={isOverLimit}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs transition-colors ${
                isOverLimit 
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={isOverLimit ? `Doing column limit reached (${doingLimit})` : 'Add new task'}
            >
              <PlusIcon className="h-3 w-3" />
              <span>Add</span>
            </button>
          )}
        </div>

        {/* Doing Column Limit Warning */}
        {columnId === 'doing' && doingLimit && (
          <div className={`flex items-center space-x-2 text-xs ${
            tasks.length >= doingLimit ? 'text-red-600' : 'text-amber-600'
          }`}>
            {tasks.length >= doingLimit && <ExclamationTriangleIcon className="h-3 w-3" />}
            <span>
              {tasks.length}/{doingLimit} tasks {tasks.length >= doingLimit && '(Limit reached)'}
            </span>
          </div>
        )}
      </div>

      {/* Tasks Container */}
      <div ref={ref} className="p-4 space-y-1 min-h-[400px]">
        {tasks
          .sort((a, b) => (a.position || 0) - (b.position || 0)) // Sort by position
          .map((task, index) => (
          <div key={task._id} className="relative">
            {/* Task Number */}
            <div className="absolute -left-3 top-3 z-10 w-5 h-5 bg-gray-200 text-gray-600 text-xs rounded-full flex items-center justify-center font-medium">
              {index + 1}
            </div>
            <DraggableTask
              task={task}
              index={index}
              columnId={columnId}
              onTaskClick={onTaskClick}
              isDisabled={isDisabled}
            />
          </div>
        ))}
        
        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <div className="text-5xl mb-3 opacity-50">
              {columnId === 'doing' && '◐'}
              {columnId === 'done' && '◉'}
              {columnId === 'todo' && '○'}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500 mb-1">
                {columnId === 'doing' && 'Doing tasks'}
                {columnId === 'done' && 'Done tasks'}
                {columnId === 'todo' && 'To do tasks'}
              </p>
              <p className="text-xs text-gray-400">
                will appear here
              </p>
            </div>
            {!isDisabled && (
              <button
                onClick={() => onCreateTask(columnId)}
                disabled={isOverLimit}
                className={`mt-4 px-3 py-2 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 transition-colors ${
                  isOverLimit ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                + Add task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};