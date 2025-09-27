import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { getReorderDestinationIndex } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index';
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import invariant from 'tiny-invariant';
import Layout from '../../components/Layout';
import { DroppableColumn } from '../../components/board/DroppableColumn';
import { CreateTaskModal } from '../../components/board/CreateTaskModal';
import { EditTaskModal } from '../../components/board/EditTaskModal';
import { TaskDetailModal } from '../../components/board/TaskDetailModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { BoardSettingsModal } from '../../components/board/BoardSettingsModal';
import { useSidebar } from '../../contexts/SidebarContext';
import { 
  useTasks, 
  useCreateTask, 
  useUpdateTask, 
  useMoveTask, 
  useDeleteTask,
  useAddTaskComment,
  useReorderTask,
  useBoardSettings,
  useUpdateBoardSettings,
  useRealTimeTaskUpdates,
  type Task,
  type CreateTaskData,
  type UpdateTaskData
} from '../../hooks/useTask';
import { useProject } from '../../hooks/useProject';
import { usePermissions } from '../../hooks/usePermissions';
import { useSocket } from '../../contexts/SocketContext';
import { CogIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type ColumnType = 'todo' | 'doing' | 'done';

const ProjectBoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createModalColumn, setCreateModalColumn] = useState<ColumnType>('todo');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showBoardSettingsModal, setShowBoardSettingsModal] = useState(false);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  // Queries
  const { project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: tasks = [], isLoading: isTasksLoading } = useTasks(projectId!);
  const { data: boardSettings } = useBoardSettings(projectId!);
  
  // Mutations
  const createTaskMutation = useCreateTask(projectId!);
  const updateTaskMutation = useUpdateTask(projectId!);
  const moveTaskMutation = useMoveTask(projectId!);
  const reorderTaskMutation = useReorderTask(projectId!);
  const deleteTaskMutation = useDeleteTask(projectId!);
  const addCommentMutation = useAddTaskComment(projectId!);
  const updateBoardSettingsMutation = useUpdateBoardSettings(projectId!);

  // Permissions
  const { can, isMember, userRole } = usePermissions(project);
  const isViewer = userRole === 'viewer';
  const isAdmin = userRole === 'admin';

  // Real-time updates
  useRealTimeTaskUpdates(projectId!);

  // Handle project deletion for navigation
  useEffect(() => {
    if (!socket || !projectId) return;

    const handleProjectDeleted = (data: any) => {
      console.log('🗑️ Project deleted event received in ProjectBoardPage:', data);
      if (data.project === projectId || data.projectId === projectId) {
        toast.error('This project has been deleted');
        navigate('/projects');
      }
    };

    socket.on('project_deleted', handleProjectDeleted);

    return () => {
      socket.off('project_deleted', handleProjectDeleted);
    };
  }, [socket, projectId, navigate]);

  // Auto-select the project in sidebar when viewing it
  useEffect(() => {
    if (project && (!selectedProject || selectedProject._id !== project._id)) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

  // State management similar to Board.jsx
  const [boardData, setBoardData] = useState(() => {
    const todoTasks = tasks.filter(task => task.column === 'todo').sort((a, b) => (a.position || 0) - (b.position || 0));
    const doingTasks = tasks.filter(task => task.column === 'doing').sort((a, b) => (a.position || 0) - (b.position || 0));
    const doneTasks = tasks.filter(task => task.column === 'done').sort((a, b) => (a.position || 0) - (b.position || 0));
    
    return {
      columnMap: {
        todo: { columnId: 'todo', title: 'To Do', items: todoTasks },
        doing: { columnId: 'doing', title: 'Doing', items: doingTasks },
        done: { columnId: 'done', title: 'Done', items: doneTasks }
      },
      orderedColumnIds: ['todo', 'doing', 'done']
    };
  });

  // Update board data when tasks change
  useEffect(() => {
    const todoTasks = tasks.filter(task => task.column === 'todo').sort((a, b) => (a.position || 0) - (b.position || 0));
    const doingTasks = tasks.filter(task => task.column === 'doing').sort((a, b) => (a.position || 0) - (b.position || 0));
    const doneTasks = tasks.filter(task => task.column === 'done').sort((a, b) => (a.position || 0) - (b.position || 0));
    
    setBoardData({
      columnMap: {
        todo: { columnId: 'todo', title: 'To Do', items: todoTasks },
        doing: { columnId: 'doing', title: 'Doing', items: doingTasks },
        done: { columnId: 'done', title: 'Done', items: doneTasks }
      },
      orderedColumnIds: ['todo', 'doing', 'done']
    });
  }, [tasks]);

  // Group tasks by column (for statistics and limits)
  const todoTasks = boardData.columnMap.todo.items;
  const doingTasks = boardData.columnMap.doing.items;
  const doneTasks = boardData.columnMap.done.items;

  // Reorder and move functions
  const reorderCard = useCallback(({
    columnId,
    startIndex,
    finishIndex,
  }: {
    columnId: string;
    startIndex: number;
    finishIndex: number;
  }) => {
    setBoardData((prevData) => {
      const sourceColumn = prevData.columnMap[columnId as keyof typeof prevData.columnMap];
      const updatedItems = reorder({
        list: sourceColumn.items,
        startIndex,
        finishIndex,
      });

      return {
        ...prevData,
        columnMap: {
          ...prevData.columnMap,
          [columnId]: {
            ...sourceColumn,
            items: updatedItems,
          },
        },
      };
    });

    // Call backend API
    const task = boardData.columnMap[columnId as keyof typeof boardData.columnMap].items[startIndex];
    if (task) {
      reorderTaskMutation.mutate({
        taskId: task._id,
        startIndex,
        finishIndex,
        column: columnId as ColumnType,
      });
    }
  }, [boardData.columnMap, reorderTaskMutation]);

  const moveCard = useCallback(({
    startColumnId,
    finishColumnId,
    itemIndexInStartColumn,
    itemIndexInFinishColumn,
  }: {
    startColumnId: string;
    finishColumnId: string;
    itemIndexInStartColumn: number;
    itemIndexInFinishColumn?: number;
  }) => {
    // Check doing column limit
    if (finishColumnId === 'doing' && boardSettings?.doingLimit) {
      const destinationColumn = boardData.columnMap[finishColumnId as keyof typeof boardData.columnMap];
      if (destinationColumn.items.length >= boardSettings.doingLimit) {
        toast.error(`Cannot move task. Doing column limit is ${boardSettings.doingLimit} tasks.`);
        return;
      }
    }

    setBoardData((prevData) => {
      const sourceColumn = prevData.columnMap[startColumnId as keyof typeof prevData.columnMap];
      const destinationColumn = prevData.columnMap[finishColumnId as keyof typeof prevData.columnMap];
      const item = sourceColumn.items[itemIndexInStartColumn];

      const destinationItems = Array.from(destinationColumn.items);
      const newIndexInDestination = itemIndexInFinishColumn ?? destinationColumn.items.length;
      destinationItems.splice(newIndexInDestination, 0, { ...item, column: finishColumnId as ColumnType });

      return {
        ...prevData,
        columnMap: {
          ...prevData.columnMap,
          [startColumnId]: {
            ...sourceColumn,
            items: sourceColumn.items.filter((_, index) => index !== itemIndexInStartColumn),
          },
          [finishColumnId]: {
            ...destinationColumn,
            items: destinationItems,
          },
        },
      };
    });

    // Call backend API
    const task = boardData.columnMap[startColumnId as keyof typeof boardData.columnMap].items[itemIndexInStartColumn];
    if (task) {
      moveTaskMutation.mutate({
        taskId: task._id,
        column: finishColumnId as ColumnType,
        position: itemIndexInFinishColumn,
      });
    }
  }, [boardData.columnMap, boardSettings?.doingLimit, moveTaskMutation]);

  // Drag and drop handling exactly like Board.jsx
  useEffect(() => {
    if (isViewer || !can.editTasks()) return;

    return monitorForElements({
      canMonitor({ source }) {
        return source.data.type === 'task';
      },
      onDragStart() {
        setIsDragging(true);
      },
      onDrop({ source, location }) {
        setIsDragging(false);
        
        if (!location.current.dropTargets.length) {
          return;
        }

        const taskId = source.data.taskId;
        invariant(typeof taskId === 'string');
        
        const sourceColumnId = source.data.sourceColumnId;
        invariant(typeof sourceColumnId === 'string');

        const sourceColumn = boardData.columnMap[sourceColumnId as keyof typeof boardData.columnMap];
        const itemIndex = sourceColumn.items.findIndex(item => item._id === taskId);

        if (location.current.dropTargets.length === 1) {
          const [destinationColumnRecord] = location.current.dropTargets;
          const destinationColumnId = destinationColumnRecord.data.columnId;
          invariant(typeof destinationColumnId === 'string');
          const destinationColumn = boardData.columnMap[destinationColumnId as keyof typeof boardData.columnMap];

          // Same column reordering to end
          if (sourceColumn === destinationColumn) {
            const destinationIndex = getReorderDestinationIndex({
              startIndex: itemIndex,
              indexOfTarget: sourceColumn.items.length - 1,
              closestEdgeOfTarget: null,
              axis: 'vertical',
            });
            reorderCard({
              columnId: sourceColumnId,
              startIndex: itemIndex,
              finishIndex: destinationIndex,
            });
            return;
          }

          // Moving to new column (to end of column)
          moveCard({
            itemIndexInStartColumn: itemIndex,
            startColumnId: sourceColumnId,
            finishColumnId: destinationColumnId,
            itemIndexInFinishColumn: destinationColumn.items.length,
          });
          return;
        }

        // Dropped on task (2 targets)
        if (location.current.dropTargets.length === 2) {
          const [destinationTaskRecord, destinationColumnRecord] = location.current.dropTargets;
          const destinationColumnId = destinationColumnRecord.data.columnId;
          invariant(typeof destinationColumnId === 'string');
          const destinationColumn = boardData.columnMap[destinationColumnId as keyof typeof boardData.columnMap];

          const indexOfTarget = destinationColumn.items.findIndex(
            item => item._id === destinationTaskRecord.data.taskId,
          );
          const closestEdgeOfTarget: Edge | null = extractClosestEdge(destinationTaskRecord.data);

          // Same column reordering
          if (sourceColumn === destinationColumn) {
            const destinationIndex = getReorderDestinationIndex({
              startIndex: itemIndex,
              indexOfTarget,
              closestEdgeOfTarget,
              axis: 'vertical',
            });
            reorderCard({
              columnId: sourceColumnId,
              startIndex: itemIndex,
              finishIndex: destinationIndex,
            });
            return;
          }

          // Cross-column move with positioning
          const destinationIndex = closestEdgeOfTarget === 'bottom' ? indexOfTarget + 1 : indexOfTarget;
          moveCard({
            itemIndexInStartColumn: itemIndex,
            startColumnId: sourceColumnId,
            finishColumnId: destinationColumnId,
            itemIndexInFinishColumn: destinationIndex,
          });
        }
      },
    });
  }, [isViewer, can, boardData, reorderCard, moveCard]);

  // Modal handlers
  const handleCreateTask = (column: ColumnType) => {
    if (!can.createTasks()) {
      toast.error('You do not have permission to create tasks.');
      return;
    }
    
    // Check doing column limit
    if (column === 'doing' && boardSettings?.doingLimit) {
      const currentDoingCount = doingTasks.length;
      if (currentDoingCount >= boardSettings.doingLimit) {
        toast.error(`Cannot create task in Doing column. Limit is ${boardSettings.doingLimit} tasks.`);
        return;
      }
    }

    setCreateModalColumn(column);
    setShowCreateModal(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const handleEditTask = (task: Task) => {
    if (!can.editTasks()) {
      toast.error('You do not have permission to edit tasks.');
      return;
    }
    setSelectedTask(task);
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!can.deleteTasks()) {
      toast.error('You do not have permission to delete tasks.');
      return;
    }
    const task = tasks?.find(t => t._id === taskId);
    if (task) {
      setTaskToDelete(task);
      setShowDeleteConfirmModal(true);
    }
  };

  const handleConfirmDelete = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete._id);
      setShowDetailModal(false);
      setShowDeleteConfirmModal(false);
      setTaskToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setTaskToDelete(null);
  };

  const handleBoardSettings = () => {
    setShowBoardSettingsModal(true);
  };

  const handleBoardSettingsSubmit = (settings: { doingLimit: number }) => {
    updateBoardSettingsMutation.mutate(settings, {
      onSuccess: () => {
        setShowBoardSettingsModal(false);
      },
    });
  };

  const handleCreateTaskSubmit = (taskData: CreateTaskData) => {
    createTaskMutation.mutate(taskData, {
      onSuccess: () => {
        setShowCreateModal(false);
      },
    });
  };

  const handleUpdateTaskSubmit = (taskData: UpdateTaskData) => {
    updateTaskMutation.mutate(taskData, {
      onSuccess: () => {
        setShowEditModal(false);
        setSelectedTask(null);
      },
    });
  };

  const handleAddComment = async (taskId: string, content: string) => {
    const updatedTask = await addCommentMutation.mutateAsync({ taskId, content });
    // Update the selected task to reflect the new comment
    if (selectedTask && selectedTask._id === taskId) {
      setSelectedTask(updatedTask);
    }
    return updatedTask;
  };

  if (isProjectLoading || isTasksLoading) {
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

  // Check if user has access to view the project
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">Project Board</p>
            {userRole && (
              <p className="text-sm text-gray-500">
                Your role: <span className="capitalize">{userRole}</span>
                {isViewer && ' (View only)'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Create Task Button */}
            {can.createTasks() && (
              <button
                onClick={() => handleCreateTask('todo')}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Task
              </button>
            )}
            
            {/* Board Settings (Admin only) */}
            {isAdmin && (
              <button
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                onClick={handleBoardSettings}
              >
                <CogIcon className="h-5 w-5" />
                <span>Board Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Board Columns */}
        <div className={`flex gap-6 overflow-x-auto pb-4 transition-all duration-200 ${
          isDragging ? 'bg-gray-50 rounded-lg p-2' : ''
        }`}>
          {boardData.orderedColumnIds.map((columnId) => (
            <DroppableColumn
              key={columnId}
              columnId={columnId as ColumnType}
              title={boardData.columnMap[columnId as keyof typeof boardData.columnMap].title}
              tasks={boardData.columnMap[columnId as keyof typeof boardData.columnMap].items}
              onTaskClick={handleTaskClick}
              onCreateTask={handleCreateTask}
              isDisabled={!can.createTasks()}
              doingLimit={columnId === 'doing' ? boardSettings?.doingLimit : undefined}
            />
          ))}
        </div>

        {/* Task Statistics */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
              <p className="text-sm text-gray-600">Total Tasks</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{todoTasks.length}</p>
              <p className="text-sm text-gray-600">To Do</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{doingTasks.length}</p>
              <p className="text-sm text-gray-600">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{doneTasks.length}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
          </div>
        </div>

        {/* Modals */}
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTaskSubmit}
          initialColumn={createModalColumn}
          isLoading={createTaskMutation.isPending}
          projectMembers={project.members}
        />

        <EditTaskModal
          task={selectedTask}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTask(null);
          }}
          onSubmit={handleUpdateTaskSubmit}
          isLoading={updateTaskMutation.isPending}
          projectMembers={project.members}
        />

        <TaskDetailModal
          task={selectedTask}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTask(null);
          }}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onAddComment={handleAddComment}
          canEdit={Boolean(can.editTasks())}
          isDeleting={deleteTaskMutation.isPending}
        />

        <ConfirmationModal
          isOpen={showDeleteConfirmModal}
          onClose={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          title="Delete Task"
          message={`Are you sure you want to delete "<strong>${taskToDelete?.title}</strong>"? This action cannot be undone.`}
          confirmText="Delete Task"
          confirmButtonColor="red"
          isLoading={deleteTaskMutation.isPending}
          loadingText="Deleting..."
        />

        <BoardSettingsModal
          isOpen={showBoardSettingsModal}
          onClose={() => setShowBoardSettingsModal(false)}
          onSubmit={handleBoardSettingsSubmit}
          currentSettings={boardSettings}
          isLoading={updateBoardSettingsMutation.isPending}
        />
      </div>
    </Layout>
  );
};

export default ProjectBoardPage;
