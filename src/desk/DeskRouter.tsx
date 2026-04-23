import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import type { User } from './types';

import DeskLayout from './components/DeskLayout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import NewTicketPage from './pages/NewTicketPage';
import { CustomerPortal, TicketDetail } from './pages/TicketDetailPage';
import AgentDashboard from './pages/AgentDashboard';
import { TeamPage, ReportsPage } from './pages/ManagerPages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 30, gcTime: 1000 * 60 * 5, retry: 1 },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 gap-3">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading your workspace…</p>
    </div>
  );
}

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuthStore();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/desk/login" replace />;
  if (roles && !roles.includes(user.role)) {
    if (user.role === 'customer') return <Navigate to="/desk/portal" replace />;
    if (user.role === 'agent') return <Navigate to="/desk/agent" replace />;
    return <Navigate to="/desk/manager" replace />;
  }
  return <>{children}</>;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, darkMode } = useAuthStore();
  // ── KEY FIX: block rendering until initial session check is done ──
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    let mounted = true;

    const fetchProfile = async (userId: string): Promise<User | null> => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const { data, error } = await supabase
          .from('users')
          .select('*, company:companies(*)')
          .eq('id', userId)
          .maybeSingle();
        if (error) return null;
        if (data) return data as User;
        await new Promise(r => setTimeout(r, attempt * 500));
      }
      return null;
    };

    // ── STEP 1: Restore session from localStorage on every page load ──
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setLoading(true);
        const profile = await fetchProfile(session.user.id);
        if (mounted) {
          setUser(profile);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
      // ── Only show the app AFTER we know the session state ──
      if (mounted) setBootDone(true);
    });

    // ── STEP 2: Keep listening for future auth changes ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' && session?.user) {
          // Only re-fetch if we don't already have this user loaded
          const currentUser = useAuthStore.getState().user;
          if (currentUser?.id === session.user.id) return;
          setLoading(true);
          const profile = await fetchProfile(session.user.id);
          if (mounted) {
            setUser(profile);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Block the entire app until first session check completes ──
  if (!bootDone) return <LoadingScreen />;

  return <>{children}</>;
}

export default function DeskRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          <Route element={<RequireAuth><DeskLayout /></RequireAuth>}>
            <Route path="portal" element={<RequireAuth roles={['customer']}><CustomerPortal /></RequireAuth>} />
            <Route path="portal/tickets/new" element={<RequireAuth roles={['customer','agent','manager']}><NewTicketPage /></RequireAuth>} />
            <Route path="portal/tickets/:id" element={<RequireAuth roles={['customer']}><TicketDetail basePath="portal" /></RequireAuth>} />

            <Route path="agent" element={<RequireAuth roles={['agent','manager']}><AgentDashboard /></RequireAuth>} />
            <Route path="agent/tickets" element={<RequireAuth roles={['agent','manager']}><AgentDashboard /></RequireAuth>} />
            <Route path="agent/tickets/:id" element={<RequireAuth roles={['agent','manager']}><TicketDetail basePath="agent" /></RequireAuth>} />
            <Route path="agent/tickets/new" element={<RequireAuth roles={['agent','manager']}><NewTicketPage /></RequireAuth>} />

            <Route path="manager" element={<RequireAuth roles={['manager']}><AgentDashboard /></RequireAuth>} />
            <Route path="manager/tickets" element={<RequireAuth roles={['manager']}><AgentDashboard /></RequireAuth>} />
            <Route path="manager/tickets/:id" element={<RequireAuth roles={['manager']}><TicketDetail basePath="manager" /></RequireAuth>} />
            <Route path="manager/team" element={<RequireAuth roles={['manager']}><TeamPage /></RequireAuth>} />
            <Route path="manager/reports" element={<RequireAuth roles={['manager']}><ReportsPage /></RequireAuth>} />

            <Route path="" element={<Navigate to="login" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}