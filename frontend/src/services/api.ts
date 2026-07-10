import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosHeaders } from 'axios';
import { toast } from 'react-hot-toast';
import { showRewardToast } from '../components/rewards/RewardToast';
import { queryClient } from './queryClient';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Default Content-Type is application/json; axios would otherwise stringify FormData as JSON.
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
          const headers = AxiosHeaders.from(config.headers);
          headers.delete('Content-Type');
          config.headers = headers;
        }
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.client.post('/auth/token/refresh/', {
                refresh: refreshToken,
              });

              const { access } = response.data;
              localStorage.setItem('access_token', access);

              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${access}`;
              }

              return this.client(originalRequest);
            }
          } catch (refreshError) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }

        if (error.response?.status === 429) {
          const detail = (error.response?.data as any)?.detail || '';
          const match = detail.match(/(\d+)\s*second/);
          if (match) {
            const secs = parseInt(match[1], 10);
            const mins = Math.ceil(secs / 60);
            toast.error(`Too many requests. Please try again in ${mins > 1 ? mins + ' minutes' : secs + ' seconds'}.`);
          } else {
            toast.error('Too many requests. Please wait a moment and try again.');
          }
        } else if (error.response?.status === 403) {
          const detail = (error.response?.data as any)?.detail || '';
          if (detail.includes('usage limit') || detail.includes('monthly limit')) {
            toast.error('Monthly usage limit reached. Upgrade to Pro for more.');
          } else if (detail.includes('premium') || detail.includes('Pro subscription')) {
            toast.error('This is a Pro feature. Upgrade to unlock it.');
          } else {
            toast.error('You do not have permission to perform this action');
          }
        } else if (error.response?.status === 500) {
          toast.error('Server error. Please try again later');
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.post<T>(url, data, config);

    // Auto-show reward toast for tool API calls
    if (url.startsWith('/tools/') && (response.data as any)?.rewards) {
      showRewardToast((response.data as any).rewards);
      // Immediately refresh the header coin display
      queryClient.invalidateQueries({ queryKey: ['reward-balance'] });
    }

    return response.data;
  }

  /** Multipart upload; browser sets multipart boundary (see request interceptor for FormData). */
  async postFormData<T>(url: string, data: FormData, config?: AxiosRequestConfig) {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();