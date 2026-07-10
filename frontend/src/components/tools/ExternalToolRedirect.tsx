import React, { useEffect } from 'react';
import LoadingScreen from '../LoadingScreen';

interface ExternalToolRedirectProps {
  externalUrl: string;
}

const ExternalToolRedirect: React.FC<ExternalToolRedirectProps> = ({ externalUrl }) => {
  useEffect(() => {
    // Redirect to external tool
    window.location.href = externalUrl;
  }, [externalUrl]);

  return <LoadingScreen />;
};

export default ExternalToolRedirect;
