import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { User, UserRole, Tag, SLAPolicy, AssignmentRule } from '../types';
import { PageHeader } from '../components/TicketComponents';

// ── Shared input style ────────────────────────────────────────
const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all";
const btnCls = "px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

// ── Section Card ──────────────────────────────────────────────
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
    <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
    {children}
  </div>
);

// ════════════════════════════════════════════════════════════════
// TEAM PAGE
// ════════════════════════════════════════════════════════════════
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
        .from('users').select('*')
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
      <div className="p-4 md:px-6 space-y-5">

        {/* Invite */}
        <Card title="Invite team member">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com" className={inputCls} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
            </select>
            <button onClick={() => { setMessage(`Invitation sent to ${inviteEmail}`); setInviteEmail(''); }}
              disabled={!inviteEmail.trim()} className={btnCls}>
              Invite
            </button>
          </div>
          {message && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{message}</p>}
        </Card>

        {/* Members */}
        <Card title={`Members (${members?.length ?? 0})`}>
          <div className="space-y-2">
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
            {members?.map(member => (
              <div key={member.id} className={`flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-opacity ${!member.is_active ? 'opacity-50' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
                  {initials(member.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.full_name}</p>
                    {member.id === user?.id && <span className="text-xs text-gray-400">(you)</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{member.email}</p>
                </div>
                {member.id !== user?.id && (
                  <div className="flex items-center gap-2">
                    <select value={member.role} onChange={e => changeRole.mutate({ id: member.id, role: e.target.value as UserRole })}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none">
                      <option value="customer">Customer</option>
                      <option value="agent">Agent</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button onClick={() => toggleActive.mutate({ id: member.id, is_active: !member.is_active })}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${member.is_active ? 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50' : 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50'}`}>
                      {member.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REPORTS PAGE
// ════════════════════════════════════════════════════════════════
export function ReportsPage() {
  const { user } = useAuthStore();

  const { data: tickets } = useQuery({
    queryKey: ['reports-tickets', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, solver:users!solved_by(full_name), assignee:users!assigned_to(full_name), csat_responses(*)')
        .eq('company_id', user!.company_id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.company_id,
  });

  if (!tickets) return <div className="p-6 text-gray-400 animate-pulse">Loading reports…</div>;

  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'open').length;
  const inProgress = tickets.filter(t => t.status === 'in_progress').length;
  const solved = tickets.filter(t => t.status === 'solved').length;
  const solveRate = total ? Math.round((solved / total) * 100) : 0;
  const slaBreached = tickets.filter(t => t.sla_resolve_due && t.status !== 'solved' && new Date(t.sla_resolve_due) < new Date()).length;

  const resolvedWithTime = tickets.filter(t => t.status === 'solved' && t.solved_at && t.created_at);
  const avgHours = resolvedWithTime.length
    ? Math.round(resolvedWithTime.reduce((acc, t) =>
        acc + (new Date(t.solved_at).getTime() - new Date(t.created_at).getTime()) / 3600000, 0
      ) / resolvedWithTime.length) : 0;

  // CSAT average
  const allCsat = tickets.flatMap(t => t.csat_responses || []);
  const avgCsat = allCsat.length
    ? (allCsat.reduce((a, c) => a + c.rating, 0) / allCsat.length).toFixed(1) : 'N/A';

  const bySource = ['call', 'whatsapp', 'email', 'linkedin'].map(s => ({
    source: s, count: tickets.filter(t => t.source === s).length,
    emoji: s === 'call' ? '📞' : s === 'whatsapp' ? '💬' : s === 'email' ? '✉️' : '💼',
  }));

  const agentMap: Record<string, { name: string; solved: number; total: number; avgCsat: number }> = {};
  tickets.forEach(t => {
    if (t.assignee?.full_name) {
      const name = t.assignee.full_name;
      if (!agentMap[name]) agentMap[name] = { name, solved: 0, total: 0, avgCsat: 0 };
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
      created: tickets.filter(t => t.created_at?.startsWith(dateStr)).length,
      solved: tickets.filter(t => t.solved_at?.startsWith(dateStr)).length,
    };
  });
  const maxCount = Math.max(...last7.map(d => Math.max(d.created, d.solved)), 1);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Performance overview and insights" />
      <div className="p-4 md:px-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total tickets', value: total, color: 'text-gray-900 dark:text-white' },
            { label: 'Solve rate', value: `${solveRate}%`, color: 'text-green-600 dark:text-green-400' },
            { label: 'Avg resolution', value: `${avgHours}h`, color: 'text-violet-600 dark:text-violet-400' },
            { label: 'Avg CSAT', value: avgCsat === 'N/A' ? 'N/A' : `${avgCsat} ★`, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Open', value: open, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'In Progress', value: inProgress, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Solved', value: solved, color: 'text-green-600 dark:text-green-400' },
            { label: 'SLA Breached', value: slaBreached, color: slaBreached > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 7-day chart */}
        <Card title="Last 7 days">
          <div className="flex items-end gap-1 h-28">
            {last7.map(day => (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5 h-20">
                  <div style={{ height: `${(day.created / maxCount) * 100}%` }} className="flex-1 bg-violet-200 dark:bg-violet-800/60 rounded-t-sm min-h-[2px]" title={`Created: ${day.created}`} />
                  <div style={{ height: `${(day.solved / maxCount) * 100}%` }} className="flex-1 bg-green-300 dark:bg-green-700/60 rounded-t-sm min-h-[2px]" title={`Solved: ${day.solved}`} />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">{day.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-200 dark:bg-violet-800/60" /><span className="text-xs text-gray-500 dark:text-gray-400">Created</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-700/60" /><span className="text-xs text-gray-500 dark:text-gray-400">Solved</span></div>
          </div>
        </Card>

        {/* By source */}
        <Card title="Tickets by source">
          <div className="space-y-3">
            {bySource.sort((a, b) => b.count - a.count).map(s => {
              const pct = total ? Math.round((s.count / total) * 100) : 0;
              return (
                <div key={s.source}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><span>{s.emoji}</span>{s.source.charAt(0).toUpperCase() + s.source.slice(1)}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{s.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <div className="h-full bg-violet-500 dark:bg-violet-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Agent leaderboard */}
        {agentStats.length > 0 && (
          <Card title="Agent performance">
            <div className="space-y-2">
              {agentStats.map((a, i) => (
                <div key={a.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-sm font-bold text-gray-400 w-6">#{i + 1}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{a.name}</span>
                  <span className="text-xs text-gray-400">{a.total} assigned</span>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">{a.solved} solved</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* CSAT breakdown */}
        {allCsat.length > 0 && (
          <Card title="CSAT Ratings">
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map(star => {
                const count = allCsat.filter(c => c.rating === star).length;
                const pct = allCsat.length ? Math.round((count / allCsat.length) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm text-amber-400 w-6">{star}★</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Status breakdown */}
        {total > 0 && (
          <Card title="Status breakdown">
            <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-8">
              {[
                { label: 'Open', count: open, cls: 'bg-blue-400 dark:bg-blue-600' },
                { label: 'In progress', count: inProgress, cls: 'bg-amber-400 dark:bg-amber-600' },
                { label: 'Solved', count: solved, cls: 'bg-green-400 dark:bg-green-600' },
              ].filter(s => s.count > 0).map(s => (
                <div key={s.label} className={`${s.cls} flex items-center justify-center text-xs text-white font-medium`}
                  style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`}>
                  {s.count > 1 ? s.count : ''}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              {[
                { label: 'Open', cls: 'bg-blue-400', count: open },
                { label: 'In progress', cls: 'bg-amber-400', count: inProgress },
                { label: 'Solved', cls: 'bg-green-400', count: solved },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${s.cls}`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{s.label} ({s.count})</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* SLA Policy Manager */}
        <SLAPolicyManager />

        {/* Tag Manager */}
        <TagManager />

        {/* Assignment Rules */}
        <AssignmentRulesManager />

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SLA POLICY MANAGER
// ════════════════════════════════════════════════════════════════
function SLAPolicyManager() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', priority: 'medium', response_hours: 4, resolve_hours: 24 });

  const { data: policies } = useQuery({
    queryKey: ['sla-policies', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('sla_policies').select('*').eq('company_id', user!.company_id);
      if (error) throw error;
      return data as SLAPolicy[];
    },
    enabled: !!user?.company_id,
  });

  const createPolicy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sla_policies').insert({ ...form, company_id: user!.company_id });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ name: '', priority: 'medium', response_hours: 4, resolve_hours: 24 });
      queryClient.invalidateQueries({ queryKey: ['sla-policies', user?.company_id] });
    },
  });

  const deletePolicy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sla_policies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-policies', user?.company_id] }),
  });

  return (
    <Card title="⏱ SLA Policies">
      <div className="space-y-3 mb-4">
        {policies?.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500">No SLA policies yet</p>}
        {policies?.map(p => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                {p.priority} · Response: {p.response_hours}h · Resolve: {p.resolve_hours}h
              </p>
            </div>
            <button onClick={() => deletePolicy.mutate(p.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4 grid grid-cols-2 gap-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Policy name" className={`${inputCls} col-span-2`} />
        <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input type="number" value={form.response_hours} onChange={e => setForm(f => ({ ...f, response_hours: +e.target.value }))} placeholder="Response hrs" className={inputCls} />
        <input type="number" value={form.resolve_hours} onChange={e => setForm(f => ({ ...f, resolve_hours: +e.target.value }))} placeholder="Resolve hrs" className={inputCls} />
        <button onClick={() => createPolicy.mutate()} disabled={!form.name || createPolicy.isPending} className={`${btnCls} col-span-2`}>
          {createPolicy.isPending ? 'Saving…' : '+ Add SLA Policy'}
        </button>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// TAG MANAGER
// ════════════════════════════════════════════════════════════════
function TagManager() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7c3aed');

  const { data: tags } = useQuery({
    queryKey: ['tags', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*').eq('company_id', user!.company_id);
      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!user?.company_id,
  });

  const createTag = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tags').insert({ name, color, company_id: user!.company_id });
      if (error) throw error;
    },
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: ['tags', user?.company_id] });
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags', user?.company_id] }),
  });

  return (
    <Card title="🏷 Tag Manager">
      <div className="flex flex-wrap gap-2 mb-4">
        {tags?.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500">No tags yet</p>}
        {tags?.map(tag => (
          <div key={tag.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>
            {tag.name}
            <button onClick={() => deleteTag.mutate(tag.id)} className="opacity-70 hover:opacity-100 ml-0.5">×</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Tag name" className={`${inputCls} flex-1`} />
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-11 h-11 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer p-1 bg-white dark:bg-gray-800" />
        <button onClick={() => createTag.mutate()} disabled={!name || createTag.isPending} className={btnCls}>
          Add
        </button>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// ASSIGNMENT RULES MANAGER
// ════════════════════════════════════════════════════════════════
function AssignmentRulesManager() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', source: '', priority: '', assign_to: '' });

  const { data: rules } = useQuery({
    queryKey: ['assignment-rules', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_rules')
        .select('*, assignee:users!assign_to(full_name)')
        .eq('company_id', user!.company_id);
      if (error) throw error;
      return data as AssignmentRule[];
    },
    enabled: !!user?.company_id,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users').select('*')
        .eq('company_id', user!.company_id)
        .in('role', ['agent', 'manager'])
        .eq('is_active', true);
      if (error) throw error;
      return data as User[];
    },
    enabled: !!user?.company_id,
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assignment_rules').insert({
        name: form.name,
        source: form.source || null,
        priority: form.priority || null,
        assign_to: form.assign_to,
        company_id: user!.company_id,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ name: '', source: '', priority: '', assign_to: '' });
      queryClient.invalidateQueries({ queryKey: ['assignment-rules', user?.company_id] });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('assignment_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignment-rules', user?.company_id] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignment_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignment-rules', user?.company_id] }),
  });

  return (
    <Card title="🤖 Auto-Assignment Rules">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        When a ticket matches these conditions, it will be automatically assigned to the selected agent.
      </p>
      <div className="space-y-2 mb-4">
        {rules?.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500">No rules yet</p>}
        {rules?.map(rule => (
          <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-opacity ${rule.is_active ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 opacity-60'}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {rule.source ? `Source: ${rule.source}` : 'Any source'} ·
                {rule.priority ? ` Priority: ${rule.priority}` : ' Any priority'} →
                {rule.assignee?.full_name || 'Unknown agent'}
              </p>
            </div>
            <button onClick={() => toggleRule.mutate({ id: rule.id, is_active: !rule.is_active })}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${rule.is_active ? 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400' : 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'}`}>
              {rule.is_active ? 'Disable' : 'Enable'}
            </button>
            <button onClick={() => deleteRule.mutate(rule.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4 grid grid-cols-2 gap-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rule name" className={`${inputCls} col-span-2`} />
        <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={inputCls}>
          <option value="">Any source</option>
          <option value="call">📞 Call</option>
          <option value="whatsapp">💬 WhatsApp</option>
          <option value="email">✉️ Email</option>
          <option value="linkedin">💼 LinkedIn</option>
        </select>
        <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
          <option value="">Any priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select value={form.assign_to} onChange={e => setForm(f => ({ ...f, assign_to: e.target.value }))} className={`${inputCls} col-span-2`}>
          <option value="">Select agent to assign…</option>
          {agents?.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.role})</option>)}
        </select>
        <button onClick={() => createRule.mutate()} disabled={!form.name || !form.assign_to || createRule.isPending} className={`${btnCls} col-span-2`}>
          {createRule.isPending ? 'Saving…' : '+ Add Rule'}
        </button>
      </div>
    </Card>
  );
}