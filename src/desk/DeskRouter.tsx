import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import type { User } from './types';

// ── Pages ──────────────────────────────────────────────────────────────────────
import DeskLayout from './components/DeskLayout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import NewTicketPage from './pages/NewTicketPage';
import { CustomerPortal, TicketDetail } from './pages/TicketDetailPage';
import AgentDashboard from './pages/AgentDashboard';
import { TeamPage, ReportsPage } from './pages/ManagerPages';

// ── QueryClient setup ─────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,      // 30 seconds
      gcTime: 1000 * 60 * 5,    // 5 minutes
      retry: 1,
    },
  },
});

// ── Auth Guard ────────────────────────────────────────────────────────────────

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/desk/login" replace />;

  if (roles && !roles.includes(user.role)) {
    // Redirect to appropriate dashboard
    if (user.role === 'customer') return <Navigate to="/desk/portal" replace />;
    if (user.role === 'agent') return <Navigate to="/desk/agent" replace />;
    return <Navigate to="/desk/manager" replace />;
  }

  return <>{children}</>;
}

// ── Bootstrap: listen to Supabase auth state ──────────────────────────────────

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, darkMode } = useAuthStore();

  useEffect(() => {
    // Apply saved dark mode
    document.documentElement.classList.toggle('dark', darkMode);

    // Check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*, company:companies(*)')
          .eq('id', session.user.id)
          .single();
        setUser(profile as User);
      }
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        return;
      }
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*, company:companies(*)')
          .eq('id', session.user.id)
          .single();
        setUser(profile as User);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}

// ── Main Desk Router ──────────────────────────────────────────────────────────

export default function DeskRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          {/* ── Protected routes ── */}
          <Route
            element={
              <RequireAuth>
                <DeskLayout />
              </RequireAuth>
            }
          >
            {/* Customer portal */}
            <Route
              path="portal"
              element={
                <RequireAuth roles={['customer']}>
                  <CustomerPortal />
                </RequireAuth>
              }
            />
            <Route
              path="portal/tickets/new"
              element={
                <RequireAuth roles={['customer', 'agent', 'manager']}>
                  <NewTicketPage />
                </RequireAuth>
              }
            />
            <Route
              path="portal/tickets/:id"
              element={
                <RequireAuth roles={['customer']}>
                  <TicketDetail basePath="portal" />
                </RequireAuth>
              }
            />

            {/* Agent */}
            <Route
              path="agent"
              element={
                <RequireAuth roles={['agent', 'manager']}>
                  <AgentDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="agent/tickets"
              element={
                <RequireAuth roles={['agent', 'manager']}>
                  <AgentDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="agent/tickets/:id"
              element={
                <RequireAuth roles={['agent', 'manager']}>
                  <TicketDetail basePath="agent" />
                </RequireAuth>
              }
            />
            <Route path="agent/tickets/new" element={<NewTicketPage />} />

            {/* Manager */}
            <Route
              path="manager"
              element={
                <RequireAuth roles={['manager']}>
                  <AgentDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="manager/tickets"
              element={
                <RequireAuth roles={['manager']}>
                  <AgentDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="manager/tickets/:id"
              element={
                <RequireAuth roles={['manager']}>
                  <TicketDetail basePath="manager" />
                </RequireAuth>
              }
            />
            <Route
              path="manager/team"
              element={
                <RequireAuth roles={['manager']}>
                  <TeamPage />
                </RequireAuth>
              }
            />
            <Route
              path="manager/reports"
              element={
                <RequireAuth roles={['manager']}>
                  <ReportsPage />
                </RequireAuth>
              }
            />

            {/* Default redirect */}
            <Route path="" element={<Navigate to="login" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}