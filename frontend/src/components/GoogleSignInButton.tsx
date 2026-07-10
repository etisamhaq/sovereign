import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface GoogleSignInButtonProps {
  /** Where to redirect after successful auth (default: /dashboard) */
  redirectTo?: string;
  /** Display text variant */
  mode?: 'signin' | 'signup';
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  redirectTo = '/dashboard',
  mode = 'signin',
}) => {
  const { googleLogin } = useAuthStore();
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse: any) => {
    const credential = credentialResponse.credential;
    if (!credential) return;

    try {
      await googleLogin(credential);
      navigate(redirectTo);
    } catch {
      // Error is handled in the store
    }
  };

  return (
    <div className="w-full">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => {
          useAuthStore.getState().clearError();
        }}
        text={mode === 'signup' ? 'signup_with' : 'signin_with'}
        shape="rectangular"
        width="100%"
        size="large"
        theme="outline"
        logo_alignment="center"
      />
    </div>
  );
};

export default GoogleSignInButton;
