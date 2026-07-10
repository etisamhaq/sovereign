export interface User {
  id: string;
  email: string;
  username?: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
  date_joined: string;
  subscription_tier: 'free' | 'pro';
  monthly_usage_count: number;
  usage_limit: number;
  usage_remaining: number;
  avatar?: string;
  bio?: string;
  preferred_language: string;
  email_notifications: boolean;
  dark_mode: boolean;
  is_pro: boolean;
  is_staff?: boolean;
  referral_code?: string;
  referral_count?: number;
}

export interface UsageInfo {
  monthly_usage: number;
  monthly_limit: number;
  remaining: number;
  percentage_used: number;
  is_pro: boolean;
  subscription_tier: string;
  free_tool_slugs: string[];
  premium_tool_slugs: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  referral_code?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}