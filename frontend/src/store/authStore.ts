import { create } from 'zustand';
import { authService, AuthResponse } from '../services/auth';
import { User, LoginCredentials, RegisterData } from '../types/auth';
import { toast } from 'react-hot-toast';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  needsVerification: boolean;

  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  googleLogin: (credential: string) => Promise<AuthResponse & { is_new_user?: boolean }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  clearVerificationFlag: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,
  needsVerification: false,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        needsVerification: response.needs_verification || false,
      });
      if (!response.needs_verification) {
        toast.success('Login successful!');
      }
      return response;
    } catch (error: any) {
      let errorMessage = 'Login failed';
      if (error.response?.status === 429) {
        const detail = error.response?.data?.detail || '';
        const match = detail.match(/(\d+)\s*second/);
        if (match) {
          const mins = Math.ceil(parseInt(match[1], 10) / 60);
          errorMessage = `Too many attempts. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`;
        } else {
          errorMessage = 'Too many attempts. Please wait a moment and try again.';
        }
      } else {
        errorMessage = error.response?.data?.message || error.response?.data?.non_field_errors?.[0] || 'Login failed';
      }
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  googleLogin: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.googleAuth(credential);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        needsVerification: false,
      });
      if (response.is_new_user) {
        toast.success('Welcome to Sovereign! Account created with Google.');
      } else {
        toast.success('Signed in with Google!');
      }
      return response;
    } catch (error: any) {
      let errorMessage = 'Google sign-in failed. Please try again.';
      if (error.response?.status === 429) {
        const detail = error.response?.data?.detail || '';
        const match = detail.match(/(\d+)\s*second/);
        if (match) {
          const mins = Math.ceil(parseInt(match[1], 10) / 60);
          errorMessage = `Too many attempts. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`;
        } else {
          errorMessage = 'Too many attempts. Please wait a moment and try again.';
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(data);
      // Don't auto-authenticate — user should sign in after registration
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        needsVerification: response.needs_verification || false,
      });
      // Clean up tokens saved by authService.register so user signs in fresh
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      return response;
    } catch (error: any) {
      // Handle different error formats
      let errorMessage = 'Registration failed';

      if (error.response?.status === 429) {
        const detail = error.response?.data?.detail || '';
        const match = detail.match(/(\d+)\s*second/);
        if (match) {
          const mins = Math.ceil(parseInt(match[1], 10) / 60);
          errorMessage = `Too many attempts. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`;
        } else {
          errorMessage = 'Too many attempts. Please wait a moment and try again.';
        }
      } else if (error.response?.data) {
        const data = error.response.data;

        // Check if it's a field-specific error
        if (typeof data === 'object' && !data.message) {
          // Format field errors
          const errors = Object.entries(data).map(([field, msg]) => {
            if (field === 'password') {
              return `Password: ${msg}`;
            }
            return `${field}: ${msg}`;
          });
          errorMessage = errors.join('. ');
        } else {
          errorMessage = data.message || data.error || 'Registration failed';
        }
      }

      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      toast.success('Logged out successfully');
    } catch (error) {
      set({ isLoading: false });
      toast.error('Logout failed');
    }
  },

  fetchUser: async () => {
    if (!authService.isAuthenticated()) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await authService.getProfile();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  updateUser: async (data) => {
    set({ isLoading: true });
    try {
      const updatedUser = await authService.updateProfile(data);
      set({
        user: updatedUser,
        isLoading: false,
      });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Update failed');
      throw error;
    }
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: true,
      needsVerification: !user.is_verified,
    });
  },

  clearError: () => set({ error: null }),

  clearVerificationFlag: () => set({ needsVerification: false }),
}));