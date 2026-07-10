import React from 'react';
import { usePageTracking } from '../services/analytics';

interface AppWithAnalyticsProps {
  children: React.ReactNode;
}

export const AppWithAnalytics: React.FC<AppWithAnalyticsProps> = ({ children }) => {
  // Enable page tracking
  usePageTracking();
  
  return <>{children}</>;
};