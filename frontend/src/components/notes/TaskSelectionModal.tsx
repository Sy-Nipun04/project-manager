import React, { useState } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface Task {
  _id: string;
  title: string;
  description?: string;
  column: 'todo' | 'doing' | 'done';
}

interface TaskSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTasks: (taskIds: string[]) => void;
  tasks: Task[];
  selectedTaskIds: string[];
}

export const TaskSelectionModal: React.FC<TaskSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectTasks,
  tasks,
  selectedTaskIds
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>(selectedTaskIds);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedTasks(selectedTaskIds);
      setSearchQuery('');
      setExpandedTaskId(null);
    }
  }, [isOpen, selectedTaskIds]);

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTaskId(prev => prev === taskId ? null : taskId);
  };

  const handleSelectTasks = () => {
    onSelectTasks(selectedTasks);
    onClose();
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

  const getColumnLabel = (column: string) => {
    switch (column) {
      case 'todo':
        return 'To Do';
      case 'doing':
        return 'Doing';
      case 'done':
        return 'Done';
      default:
        return column;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Select Tasks</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {filteredTasks.length > 0 ? (
            <div className="p-4 space-y-2">
              {filteredTasks.map((task) => (
                <div key={task._id} className="border border-gray-200 rounded-lg">
                  {/* Task Header */}
                  <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3 flex-1">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedTasks.includes(task._id)}
                        onChange={() => toggleTaskSelection(task._id)}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                      />
                      
                      {/* Task Title */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{task.title}</h3>
                      </div>

                      {/* Column Badge */}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getColumnColor(task.column)}`}>
                        {getColumnLabel(task.column)}
                      </span>
                    </div>

                    {/* Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => toggleTaskExpansion(task._id)}
                      className="ml-2 p-2 hover:bg-gray-200 rounded-md transition-colors border border-transparent hover:border-gray-300"
                      title={expandedTaskId === task._id ? "Hide details" : "Show details"}
                    >
                      {expandedTaskId === task._id ? (
                        <ChevronDownIcon className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                  </div>

                  {/* Task Description (Expandable) */}
                  {expandedTaskId === task._id && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                      <div className="text-sm text-gray-600 mt-2 max-w-full max-h-32 overflow-y-auto">
                        {task.description && task.description !== 'No description available' ? (
                          <p className="whitespace-pre-wrap break-words">{task.description}</p>
                        ) : (
                          <p className="text-gray-500 italic">This task doesn't have a description yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>No tasks found matching your search criteria.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSelectTasks}
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
            >
              Select Tasks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};