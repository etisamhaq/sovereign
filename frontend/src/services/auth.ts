import { apiClient } from './api';
import { User, LoginCredentials, RegisterData, AuthTokens } from '../types/auth';

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  message?: string;
  needs_verification?: boolean;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login/', credentials);

    localStorage.setItem('access_token', response.tokens.access);
    localStorage.setItem('refresh_token', response.tokens.refresh);

    return response;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register/', data);

    localStorage.setItem('access_token', response.tokens.access);
    localStorage.setItem('refresh_token', response.tokens.refresh);

    return response;
  },

  async logout() {
    const refreshToken = localStorage.getItem('refresh_token');

    try {
      await apiClient.post('/auth/logout/', { refresh_token: refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  async getProfile() {
    return apiClient.get<User>('/auth/profile/');
  },

  async updateProfile(data: Partial<User>) {
    return apiClient.patch<User>('/auth/profile/', data);
  },

  async updateProfileWithAvatar(data: FormData) {
    return apiClient.patch<User>('/auth/profile/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async changePassword(data: {
    old_password: string;
    new_password: string;
    new_password_confirm: string;
  }) {
    return apiClient.post('/auth/password/change/', data);
  },

  async requestPasswordReset(email: string) {
    return apiClient.post('/auth/password/reset/', { email });
  },

  async confirmPasswordReset(data: {
    token: string;
    password: string;
    password_confirm: string;
  }) {
    return apiClient.post('/auth/password/reset/confirm/', data);
  },

  async verifyEmail(token: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/email/verify/', { token });

    // Update tokens if returned (auto-login after verification)
    if (response.tokens) {
      localStorage.setItem('access_token', response.tokens.access);
      localStorage.setItem('refresh_token', response.tokens.refresh);
    }

    return response;
  },

  async resendVerificationEmail(email?: string) {
    return apiClient.post('/auth/email/resend-verification/', email ? { email } : {});
  },

  async googleAuth(credential: string): Promise<AuthResponse & { is_new_user?: boolean }> {
    const response = await apiClient.post<AuthResponse & { is_new_user?: boolean }>(
      '/auth/google/',
      { credential }
    );

    localStorage.setItem('access_token', response.tokens.access);
    localStorage.setItem('refresh_token', response.tokens.refresh);

    return response;
  },

  // Referral program
  async getReferralStats() {
    return apiClient.get('/rewards/referrals/');
  },

  async getReferralHistory(page = 1) {
    return apiClient.get(`/rewards/referrals/history/?page=${page}`);
  },

  async validateReferralCode(referral_code: string) {
    return apiClient.post('/rewards/referrals/validate/', { referral_code });
  },

  async getReferralLeaderboard() {
    return apiClient.get('/rewards/referrals/leaderboard/');
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  getAccessToken() {
    return localStorage.getItem('access_token');
  },
};