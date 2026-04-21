import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  ticket: 'M15 5v2M15 11v2M15 17v2M5 5h4l2 7-2 7H5l2-7z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  report: 'M18 20V10M12 20V4M6 20v-6',
  sun: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  plus: 'M12 5v14M5 12h14',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
};

const getNavItems = (role: string) => {
  if (role === 'customer') {
    return [
      { label: 'My Tickets', path: '/desk/portal', icon: 'inbox' },
      { label: 'New Ticket', path: '/desk/portal/tickets/new', icon: 'plus' },
    ];
  }
  if (role === 'agent') {
    return [
      { label: 'Dashboard', path: '/desk/agent', icon: 'dashboard' },
      { label: 'All Tickets', path: '/desk/agent/tickets', icon: 'ticket' },
    ];
  }
  return [
    { label: 'Dashboard', path: '/desk/manager', icon: 'dashboard' },
    { label: 'All Tickets', path: '/desk/manager/tickets', icon: 'ticket' },
    { label: 'Team', path: '/desk/manager/team', icon: 'users' },
    { label: 'Reports', path: '/desk/manager/reports', icon: 'report' },
  ];
};

export default function DeskLayout() {
  const { user, darkMode, toggleDarkMode, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    navigate('/desk/login');
    return null;
  }

  const navItems = getNavItems(user.role);
  const initials = user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/desk/login');
  };

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path.endsWith('/portal') || item.path.endsWith('/agent') || item.path.endsWith('/manager')}
          className={({ isActive }) =>
            mobile
              ? `flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`
              : `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}`
          }
          onClick={() => setSidebarOpen(false)}
        >
          <Icon d={icons[item.icon as keyof typeof icons]} size={mobile ? 22 : 18} />
          {mobile ? <span>{item.label}</span> : item.label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-30">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">DeskCRM</p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">deepusiva.com</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-1">
          <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Icon d={darkMode ? icons.sun : icons.moon} size={18} />
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors">
            <Icon d={icons.logout} size={18} />
            Sign out
          </button>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate text-gray-900 dark:text-white">{user.full_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 z-30">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">DeskCRM</span>
        <button onClick={toggleDarkMode} className="p-2 text-gray-500 dark:text-gray-400">
          <Icon d={darkMode ? icons.sun : icons.moon} size={18} />
        </button>
        <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300">
          {initials}
        </div>
      </header>

      <main className="md:pl-60">
        <div className="pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-30 flex">
        <NavLinks mobile />
        <button onClick={handleSignOut} className="flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-auto">
          <Icon d={icons.logout} size={22} />
          <span>Sign out</span>
        </button>
      </nav>
    </div>
  );
}