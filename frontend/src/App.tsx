import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HelmetProvider } from 'react-helmet-async';
import { useAuthStore } from './store/authStore';
import { analytics } from './services/analytics';
import { ThemeProvider } from './contexts/ThemeContext';
import { queryClient } from './services/queryClient';

import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';

import PrivateRoute from './components/PrivateRoute';
import LoadingScreen from './components/LoadingScreen';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { AppWithAnalytics } from './components/AppWithAnalytics';
import ChatBot from './components/ChatBot';

// All page bundles are code-split. Each `lazy()` call produces an async chunk
// that's only fetched on first navigation, dramatically improving initial
// paint time and TTI on cold loads.
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const ToolPage = lazy(() => import('./pages/ToolPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'));
const TryToolsPage = lazy(() => import('./pages/TryToolsPage'));
const SharedResultPage = lazy(() => import('./pages/SharedResultPage'));
const ToolLandingPage = lazy(() => import('./pages/ToolLandingPage'));
const ForPersonaPage = lazy(() => import('./pages/ForPersonaPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const MarketplaceToolDetailPage = lazy(() => import('./pages/MarketplaceToolDetailPage'));

// Enterprise agent control plane (workspaces, runs, marketplace, sellers)
const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const AgentRunDetailPage = lazy(() => import('./pages/AgentRunDetailPage'));
const AgentMarketplacePage = lazy(() => import('./pages/agents/AgentMarketplacePage'));
const AgentMarketplaceDetailPage = lazy(() => import('./pages/agents/AgentMarketplaceDetailPage'));
const PublishListingPage = lazy(() => import('./pages/agents/PublishListingPage'));
const SellerDashboardPage = lazy(() => import('./pages/agents/SellerDashboardPage'));

// Streaming chat agent (multi-LLM router, function calling, YAML workflows)
const AgentChatPage = lazy(() => import('./pages/AgentPage'));

const CommunityPage = lazy(() => import('./pages/community/CommunityPage'));
const PostDetailPage = lazy(() => import('./pages/community/PostDetailPage'));
const NewPostPage = lazy(() => import('./pages/community/NewPostPage'));
const EditPostPage = lazy(() => import('./pages/community/EditPostPage'));
const MyPostsPage = lazy(() => import('./pages/community/MyPostsPage'));
const SolutionAutomationPage = lazy(() => import('./pages/solutions/SolutionAutomationPage'));
const SolutionAgentsPage = lazy(() => import('./pages/solutions/SolutionAgentsPage'));
const SolutionOptimizationPage = lazy(() => import('./pages/solutions/SolutionOptimizationPage'));
const RequestSuccessPage = lazy(() => import('./pages/solutions/RequestSuccessPage'));
const MyServiceRequestsPage = lazy(() => import('./pages/solutions/MyServiceRequestsPage'));
const AdminServiceRequestsPage = lazy(() => import('./pages/solutions/AdminServiceRequestsPage'));

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Hide ChatBot on auth + full-screen chat agent page where it's redundant or
// distracting. The dedicated /chat page already exposes the same agent runtime
// in a wider, immersive layout.
const ConditionalChatBot: React.FC = () => {
  const location = useLocation();
  const hidePrefixes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/chat',
  ];
  if (hidePrefixes.some((p) => location.pathname.startsWith(p))) return null;
  return <ChatBot />;
};

function App() {
  const { fetchUser, user } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    fetchUser().finally(() => setIsInitialized(true));
  }, [fetchUser]);

  useEffect(() => {
    if (user?.id) {
      analytics.setUserId(user.id);
    }
  }, [user]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <HelmetProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Router>
              <ScrollToTop />
              <AppWithAnalytics>
                <ErrorBoundary>
                  <div className="min-h-screen">
                    <Toaster
                      position="top-right"
                      toastOptions={{
                        duration: 4000,
                        style: { background: '#363636', color: '#fff' },
                        success: { style: { background: '#10b981' } },
                        error: { style: { background: '#ef4444' } },
                      }}
                    />
                    <Suspense fallback={<LoadingScreen />}>
                      <Routes>
                        {/* Public routes */}
                        <Route element={<MainLayout />}>
                          <Route path="/" element={<HomePage />} />
                          <Route path="/pricing" element={<PricingPage />} />
                          <Route path="/about" element={<AboutPage />} />
                          <Route path="/contact" element={<ContactPage />} />
                          <Route path="/blog" element={<BlogPage />} />
                          <Route path="/blog/:slug" element={<BlogPostPage />} />
                          <Route path="/features" element={<FeaturesPage />} />
                          <Route path="/workflows" element={<WorkflowsPage />} />
                          <Route path="/privacy" element={<PrivacyPage />} />
                          <Route path="/terms" element={<TermsPage />} />
                          <Route path="/try-tools" element={<TryToolsPage />} />
                          <Route path="/shared/:shareId" element={<SharedResultPage />} />
                          <Route path="/community" element={<CommunityPage />} />
                          <Route path="/community/post/:slug" element={<PostDetailPage />} />

                          {/* Solutions landing pages */}
                          <Route path="/solutions/automation" element={<SolutionAutomationPage />} />
                          <Route path="/solutions/agents" element={<SolutionAgentsPage />} />
                          <Route path="/solutions/optimization" element={<SolutionOptimizationPage />} />
                          <Route path="/solutions/request-success" element={<RequestSuccessPage />} />

                          {/* SEO: Public tool landing pages — crawlable by Google */}
                          <Route path="/tool/:slug" element={<ToolLandingPage />} />

                          {/* SEO: Persona-based discovery pages */}
                          <Route path="/for/:personaId" element={<ForPersonaPage />} />
                        </Route>

                        {/* Auth routes */}
                        <Route element={<AuthLayout />}>
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/register" element={<RegisterPage />} />
                          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                          <Route path="/reset-password" element={<ResetPasswordPage />} />
                          <Route path="/verify-email" element={<VerifyEmailPage />} />
                        </Route>

                        {/* Protected routes (authenticated tool interface) */}
                        <Route element={<PrivateRoute />}>
                          <Route element={<MainLayout />}>
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/tools" element={<ToolsPage />} />
                            <Route path="/tools/:slug" element={<ToolPage />} />
                            <Route path="/history" element={<HistoryPage />} />
                            <Route path="/marketplace" element={<MarketplacePage />} />
                            <Route path="/marketplace/:slug" element={<MarketplaceToolDetailPage />} />

                            {/* Enterprise agent platform */}
                            <Route path="/agents" element={<AgentsPage />} />
                            <Route path="/agents/runs/:runId" element={<AgentRunDetailPage />} />
                            <Route path="/agents/marketplace" element={<AgentMarketplacePage />} />
                            <Route path="/agents/marketplace/publish" element={<PublishListingPage />} />
                            <Route path="/agents/marketplace/dashboard" element={<SellerDashboardPage />} />
                            <Route path="/agents/marketplace/:id" element={<AgentMarketplaceDetailPage />} />

                            {/* Streaming chat agent — full-screen immersive surface */}
                            <Route path="/chat" element={<AgentChatPage />} />

                            <Route path="/referrals" element={<ReferralPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/community/new" element={<NewPostPage />} />
                            <Route path="/community/edit/:slug" element={<EditPostPage />} />
                            <Route path="/community/my-posts" element={<MyPostsPage />} />
                            <Route path="/solutions/my-requests" element={<MyServiceRequestsPage />} />
                            <Route path="/admin/service-requests" element={<AdminServiceRequestsPage />} />
                          </Route>
                        </Route>

                        {/* Catch all - 404 */}
                        <Route element={<MainLayout />}>
                          <Route path="*" element={<NotFoundPage />} />
                        </Route>
                      </Routes>
                    </Suspense>
                    <ConditionalChatBot />
                  </div>
                </ErrorBoundary>
              </AppWithAnalytics>
            </Router>
          </ThemeProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </HelmetProvider>
  );
}

export default App;
