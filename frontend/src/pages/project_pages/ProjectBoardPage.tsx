import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
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
  useBoardSettings,
  useUpdateBoardSettings,
  useRealTimeTaskUpdates,
  type Task,
  type CreateTaskData,
  type UpdateTaskData
} from '../../hooks/useTask';
import { useProject } from '../../hooks/useProject';
import { usePermissions } from '../../hooks/usePermissions';
import { CogIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type ColumnType = 'todo' | 'doing' | 'done';

const ProjectBoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject, setSelectedProject } = useSidebar();
  
  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createModalColumn, setCreateModalColumn] = useState<ColumnType>('todo');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showBoardSettingsModal, setShowBoardSettingsModal] = useState(false);

  // Queries
  const { project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: tasks = [], isLoading: isTasksLoading } = useTasks(projectId!);
  const { data: boardSettings } = useBoardSettings(projectId!);
  
  // Mutations
  const createTaskMutation = useCreateTask(projectId!);
  const updateTaskMutation = useUpdateTask(projectId!);
  const moveTaskMutation = useMoveTask(projectId!);
  const deleteTaskMutation = useDeleteTask(projectId!);
  const addCommentMutation = useAddTaskComment(projectId!);
  const updateBoardSettingsMutation = useUpdateBoardSettings(projectId!);

  // Permissions
  const { can, isMember, userRole } = usePermissions(project);
  const isViewer = userRole === 'viewer';
  const isAdmin = userRole === 'admin';

  // Real-time updates
  useRealTimeTaskUpdates(projectId!);

  // Auto-select the project in sidebar when viewing it
  useEffect(() => {
    if (project && (!selectedProject || selectedProject._id !== project._id)) {
      setSelectedProject(project);
    }
  }, [project, selectedProject, setSelectedProject]);

  // Group tasks by column
  const todoTasks = tasks.filter(task => task.column === 'todo');
  const doingTasks = tasks.filter(task => task.column === 'doing');
  const doneTasks = tasks.filter(task => task.column === 'done');

  // Drag and drop handling
  useEffect(() => {
    if (isViewer || !can.editTasks()) return; // Viewers can't drag

    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];
        if (!destination) return;

        const taskId = source.data.taskId as string;
        const sourceColumnId = source.data.sourceColumnId as string;
        const destColumnId = destination.data.columnId as string;

        // Don't do anything if dropped in same column
        if (sourceColumnId === destColumnId) return;

        // Check doing column limit
        if (destColumnId === 'doing' && boardSettings?.doingLimit) {
          const currentDoingCount = doingTasks.length;
          if (currentDoingCount >= boardSettings.doingLimit) {
            toast.error(`Cannot move task. Doing column limit is ${boardSettings.doingLimit} tasks.`);
            return;
          }
        }

        // Perform the move
        moveTaskMutation.mutate({
          taskId,
          column: destColumnId as ColumnType,
        });
      },
    });
  }, [isViewer, can, doingTasks.length, boardSettings?.doingLimit, moveTaskMutation]);

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
        <div className="flex gap-6 overflow-x-auto pb-4">
          <DroppableColumn
            columnId="doing"
            title="Doing"
            tasks={doingTasks}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
            isDisabled={!can.createTasks()}
            doingLimit={boardSettings?.doingLimit}
          />
          
          <DroppableColumn
            columnId="done"
            title="Done"
            tasks={doneTasks}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
            isDisabled={!can.createTasks()}
          />
          
          <DroppableColumn
            columnId="todo"
            title="To Do"
            tasks={todoTasks}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
            isDisabled={!can.createTasks()}
          />
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
