import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { User, UserRole } from '../types';
import { PageHeader } from '../components/TicketComponents';

export function TeamPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('agent');
  const [message, setMessage] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['team', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', user!.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as User[];
    },
    enabled: !!user?.company_id,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('users').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', user?.company_id] }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from('users').update({ role }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', user?.company_id] }),
  });

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader title="Team" subtitle="Manage your staff and their access" />

      <div className="p-4 md:px-6 md:py-5">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Invite team member</h2>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
            </select>
            <button
              onClick={() => setMessage(`Invitation sent to ${inviteEmail}`)}
              disabled={!inviteEmail.trim()}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              Invite
            </button>
          </div>
          {message && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{message}</p>}
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 animate-pulse" />
        ))}
        {members?.map((member) => (
          <div key={member.id} className={`flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4 transition-opacity ${!member.is_active ? 'opacity-60' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
              {initials(member.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.full_name}</p>
                {member.id === user?.id && <span className="text-xs text-gray-400 dark:text-gray-500">(you)</span>}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{member.email}</p>
            </div>
            {member.id !== user?.id && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <select value={member.role} onChange={(e) => changeRole.mutate({ id: member.id, role: e.target.value as UserRole })}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none">
                  <option value="customer">Customer</option>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                </select>
                <button
                  onClick={() => toggleActive.mutate({ id: member.id, is_active: !member.is_active })}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${member.is_active ? 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30' : 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30'}`}>
                  {member.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuthStore();

  const { data: tickets } = useQuery({
    queryKey: ['reports-tickets', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, solver:users!solved_by(full_name), assignee:users!assigned_to(full_name)')
        .eq('company_id', user!.company_id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.company_id,
  });

  if (!tickets) return <div className="p-6 text-gray-400">Loading…</div>;

  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'open').length;
  const inProgress = tickets.filter(t => t.status === 'in_progress').length;
  const solved = tickets.filter(t => t.status === 'solved').length;
  const solveRate = total ? Math.round((solved / total) * 100) : 0;

  const resolvedWithTime = tickets.filter(t => t.status === 'solved' && t.solved_at && t.created_at);
  const avgHours = resolvedWithTime.length
    ? Math.round(resolvedWithTime.reduce((acc, t) => acc + (new Date(t.solved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000, 0) / resolvedWithTime.length)
    : 0;

  const bySource = ['call', 'whatsapp', 'email', 'linkedin'].map(s => ({
    source: s, count: tickets.filter(t => t.source === s).length,
    emoji: s === 'call' ? '📞' : s === 'whatsapp' ? '💬' : s === 'email' ? '✉️' : '💼',
  }));

  const agentMap: Record<string, { name: string; solved: number; total: number }> = {};
  tickets.forEach(t => {
    if (t.assignee?.full_name) {
      const name = t.assignee.full_name;
      if (!agentMap[name]) agentMap[name] = { name, solved: 0, total: 0 };
      agentMap[name].total++;
      if (t.status === 'solved') agentMap[name].solved++;
    }
  });
  const agentStats = Object.values(agentMap).sort((a, b) => b.solved - a.solved);

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      created: tickets.filter(t => t.created_at.startsWith(dateStr)).length,
      solved: tickets.filter(t => t.solved_at?.startsWith(dateStr)).length,
    };
  });
  const maxCount = Math.max(...last7.map(d => Math.max(d.created, d.solved)), 1);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Performance overview and insights" />
      <div className="p-4 md:px-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total tickets', value: total, color: 'text-gray-900 dark:text-white' },
            { label: 'Solve rate', value: `${solveRate}%`, color: 'text-green-600 dark:text-green-400' },
            { label: 'Avg resolution', value: `${avgHours}h`, color: 'text-violet-600 dark:text-violet-400' },
            { label: 'Open now', value: open, color: 'text-blue-600 dark:text-blue-400' },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Last 7 days</h2>
          <div className="flex items-end gap-1 h-28">
            {last7.map((day) => (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5 h-20">
                  <div style={{ height: `${(day.created / maxCount) * 100}%` }} className="flex-1 bg-violet-200 dark:bg-violet-800/60 rounded-t-sm min-h-1" />
                  <div style={{ height: `${(day.solved / maxCount) * 100}%` }} className="flex-1 bg-green-300 dark:bg-green-700/60 rounded-t-sm min-h-1" />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">{day.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-200 dark:bg-violet-800/60" /><span className="text-xs text-gray-500 dark:text-gray-400">Created</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-700/60" /><span className="text-xs text-gray-500 dark:text-gray-400">Solved</span></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tickets by source</h2>
          <div className="space-y-3">
            {bySource.sort((a, b) => b.count - a.count).map((s) => {
              const pct = total ? Math.round((s.count / total) * 100) : 0;
              return (
                <div key={s.source}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><span>{s.emoji}</span>{s.source.charAt(0).toUpperCase() + s.source.slice(1)}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{s.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <div className="h-full bg-violet-500 dark:bg-violet-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {agentStats.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Agent performance</h2>
            <div className="space-y-2">
              {agentStats.map((a, i) => (
                <div key={a.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500 w-5">#{i + 1}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{a.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{a.total} assigned</span>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">{a.solved} solved</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Status breakdown</h2>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-8">
            {[
              { label: 'Open', count: open, cls: 'bg-blue-400 dark:bg-blue-600' },
              { label: 'In progress', count: inProgress, cls: 'bg-amber-400 dark:bg-amber-600' },
              { label: 'Solved', count: solved, cls: 'bg-green-400 dark:bg-green-600' },
            ].filter(s => s.count > 0).map((s) => (
              <div key={s.label} className={`${s.cls} flex items-center justify-center text-xs text-white font-medium`} style={{ width: `${(s.count / total) * 100}%` }}>
                {s.count > 1 ? s.count : ''}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3">
            {[
              { label: 'Open', cls: 'bg-blue-400', count: open },
              { label: 'In progress', cls: 'bg-amber-400', count: inProgress },
              { label: 'Solved', cls: 'bg-green-400', count: solved },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${s.cls}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.label} ({s.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}