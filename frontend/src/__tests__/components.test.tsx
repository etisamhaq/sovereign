import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

jest.mock('framer-motion', () => {
  const Real = jest.requireActual('react');
  const proxy = new Proxy(
    {},
    {
      get: () => (props: any) => Real.createElement('div', props, props.children),
    }
  );
  return {
    motion: proxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => Real.createElement(Real.Fragment, null, children),
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn(), set: jest.fn() }),
    useScroll: () => ({ scrollY: { onChange: jest.fn() }, scrollYProgress: { onChange: jest.fn() } }),
    useTransform: () => 0,
    useInView: () => false,
    useMotionValue: (v: any) => ({ get: () => v, set: jest.fn(), onChange: jest.fn() }),
    LayoutGroup: ({ children }: { children: React.ReactNode }) => Real.createElement(Real.Fragment, null, children),
  };
});

import ToolCard from '../components/ToolCard';
import LoadingScreen from '../components/LoadingScreen';
import { useAuthStore } from '../store/authStore';

jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

const setAuthState = (state: Partial<ReturnType<typeof useAuthStore.getState>>) => {
  useAuthStore.setState(state as any, false);
};

describe('ToolCard', () => {
  const mockTool = {
    id: '1',
    name: 'AI Paraphrasing Tool',
    slug: 'paraphrase',
    description: 'Rewrite any text instantly with multiple modes',
    category: 'writing',
    icon: 'pencil-square',
    is_premium: false,
    is_implemented: true,
    usage_count: 1234,
    user_has_access: true,
  };

  const premiumTool = { ...mockTool, id: '2', name: 'AI Essay Writer', slug: 'essay', is_premium: true };

  beforeEach(() => {
    setAuthState({ isAuthenticated: true });
  });

  test('renders tool name and description', () => {
    render(
      <BrowserRouter>
        <ToolCard tool={mockTool} />
      </BrowserRouter>
    );

    expect(screen.getByText('AI Paraphrasing Tool')).toBeInTheDocument();
    expect(screen.getByText(/rewrite any text instantly/i)).toBeInTheDocument();
    expect(screen.getByText(/1,234 times/i)).toBeInTheDocument();
  });

  test('shows Pro badge for premium tools', () => {
    render(
      <BrowserRouter>
        <ToolCard tool={premiumTool} />
      </BrowserRouter>
    );
    expect(screen.getByText(/Pro/i)).toBeInTheDocument();
  });

  test('links to tool slug when authenticated and has access', () => {
    render(
      <BrowserRouter>
        <ToolCard tool={mockTool} />
      </BrowserRouter>
    );

    const link = screen.getByRole('link', { name: /use tool/i });
    expect(link).toHaveAttribute('href', '/tools/paraphrase');
  });

  test('shows login link for unauthenticated users', () => {
    setAuthState({ isAuthenticated: false });
    render(
      <BrowserRouter>
        <ToolCard tool={mockTool} />
      </BrowserRouter>
    );
    const link = screen.getByRole('link', { name: /login to use/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});

describe('LoadingScreen', () => {
  test('renders loading text', () => {
    render(<LoadingScreen />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
