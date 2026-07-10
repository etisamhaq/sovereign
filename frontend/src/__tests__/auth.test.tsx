import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from '../store/authStore';

jest.mock('../services/auth');

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <HelmetProvider>
      <GoogleOAuthProvider clientId="test-client-id">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>{component}</BrowserRouter>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </HelmetProvider>
  );
};

describe('Auth pages', () => {
  beforeEach(() => {
    useAuthStore.setState(
      {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      } as any,
      false
    );
  });

  test('LoginPage renders welcome heading and email/password inputs', async () => {
    const { default: LoginPage } = await import('../pages/LoginPage');
    renderWithProviders(<LoginPage />);

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i, { selector: 'input' })).toBeInTheDocument();
  });

  test('RegisterPage renders create-your-account form', async () => {
    const { default: RegisterPage } = await import('../pages/RegisterPage');
    renderWithProviders(<RegisterPage />);

    expect(
      screen.getByRole('heading', { level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });
});
