import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export const useAuthCheck = (redirectTo?: string) => {
  const { isAuthenticated, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      // If there's a token but auth state says not authenticated, fetch user
      const token = localStorage.getItem('access_token');
      if (token && !isAuthenticated) {
        await fetchUser();
      }
      
      // If still not authenticated and redirect specified, navigate
      if (!isAuthenticated && redirectTo) {
        navigate(redirectTo);
      }
    };

    checkAuth();
  }, [isAuthenticated, fetchUser, navigate, redirectTo]);

  return isAuthenticated;
};