import { authService } from '../services/auth';
import { apiClient } from '../services/api';
import { analytics } from '../services/analytics';

jest.mock('../services/api');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('successful login stores tokens', async () => {
      const mockResponse = {
        tokens: {
          access: 'mock-access-token',
          refresh: 'mock-refresh-token',
        },
        user: {
          id: 1,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
        },
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse as any);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login/', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(localStorage.getItem('access_token')).toBe('mock-access-token');
      expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
      expect(result).toEqual(mockResponse);
    });

    test('failed login throws error and does not store tokens', async () => {
      const mockError = {
        response: {
          data: {
            detail: 'Invalid credentials',
          },
        },
      };

      mockApiClient.post.mockRejectedValueOnce(mockError);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toBeDefined();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('register', () => {
    test('successful registration stores tokens', async () => {
      const mockResponse = {
        tokens: {
          access: 'mock-access-token',
          refresh: 'mock-refresh-token',
        },
        user: {
          id: 1,
          email: 'newuser@example.com',
          first_name: 'New',
          last_name: 'User',
        },
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse as any);

      const payload = {
        email: 'newuser@example.com',
        password: 'password123',
        password_confirm: 'password123',
        first_name: 'New',
        last_name: 'User',
        username: 'newuser',
      } as any;

      const result = await authService.register(payload);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register/', payload);
      expect(localStorage.getItem('access_token')).toBe('mock-access-token');
      expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('logout', () => {
    test('clears tokens from localStorage even when API call fails', async () => {
      localStorage.setItem('access_token', 'mock-access-token');
      localStorage.setItem('refresh_token', 'mock-refresh-token');

      mockApiClient.post.mockRejectedValueOnce(new Error('boom'));

      const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await authService.logout();
      } finally {
        consoleErr.mockRestore();
      }

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout/', {
        refresh_token: 'mock-refresh-token',
      });
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('getProfile', () => {
    test('fetches the current user profile', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      };
      mockApiClient.get.mockResolvedValueOnce(mockUser as any);

      const result = await authService.getProfile();
      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/profile/');
      expect(result).toEqual(mockUser);
    });
  });

  describe('helpers', () => {
    test('isAuthenticated reflects access token presence', () => {
      expect(authService.isAuthenticated()).toBe(false);
      localStorage.setItem('access_token', 'tok');
      expect(authService.isAuthenticated()).toBe(true);
    });

    test('getAccessToken returns the stored token', () => {
      expect(authService.getAccessToken()).toBeNull();
      localStorage.setItem('access_token', 'tok');
      expect(authService.getAccessToken()).toBe('tok');
    });
  });
});

describe('Analytics Service', () => {
  beforeEach(() => {
    window.gtag = jest.fn();
    window.dataLayer = [];
    analytics.setUserId(null);
  });

  test('trackPageView sends page view event', () => {
    analytics.trackPageView('/dashboard', 'Dashboard');

    expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/dashboard',
      page_title: 'Dashboard',
      user_id: null,
    });
  });

  test('trackEvent sends custom event', () => {
    analytics.trackEvent('button_click', {
      category: 'ui',
      label: 'header_cta',
      value: 1,
    });

    expect(window.gtag).toHaveBeenCalledWith('event', 'button_click', {
      event_category: 'ui',
      event_label: 'header_cta',
      value: 1,
      user_id: null,
    });
  });

  test('trackToolUsage sends tool usage event', () => {
    analytics.trackToolUsage('Paraphrasing Tool', 'writing');

    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'tool_usage',
      expect.objectContaining({
        event_category: 'tools',
        event_label: 'Paraphrasing Tool',
        tool_category: 'writing',
        user_id: null,
      })
    );
  });

  test('trackConversion sends conversion event', () => {
    analytics.trackConversion('subscription', 300);

    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'conversion_subscription',
      expect.objectContaining({
        event_category: 'conversion',
        value: 300,
        user_id: null,
      })
    );
  });

  test('setUserId updates user ID for tracking', () => {
    analytics.setUserId('user123');
    analytics.trackPageView('/profile');

    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/profile',
        user_id: 'user123',
      })
    );
  });
});
