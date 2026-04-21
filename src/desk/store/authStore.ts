import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  darkMode: boolean;
  setUser: (user: User | null) => void;
  setLoading: (v: boolean) => void;
  toggleDarkMode: () => void;
  signOut: () => Promise<void>;
  isCustomer: () => boolean;
  isAgent: () => boolean;
  isManager: () => boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      darkMode: false,

      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),

      toggleDarkMode: () => {
        const next = !get().darkMode;
        set({ darkMode: next });
        document.documentElement.classList.toggle('dark', next);
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null });
      },

      isCustomer: () => get().user?.role === 'customer',
      isAgent: () => {
        const role = get().user?.role;
        return role === 'agent' || role === 'manager';
      },
      isManager: () => get().user?.role === 'manager',
      hasRole: (roles) => {
        const role = get().user?.role;
        return role ? roles.includes(role) : false;
      },
    }),
    {
      name: 'desk-auth',
      partialize: (state) => ({ darkMode: state.darkMode }),
    }
  )
);