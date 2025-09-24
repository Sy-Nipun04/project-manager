import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const ProjectRedirect: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  
  return <Navigate to={`/project/${projectId}/board`} replace />;
};

export default ProjectRedirect;