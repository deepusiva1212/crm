import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Ticket, TicketStatus, TicketSource, User } from '../types';
import { TicketCard, TicketSkeleton, EmptyState, PageHeader, StatsRow } from '../components/TicketComponents';

const statusFilters: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'solved', label: 'Solved' },
];

const sourceFilters: { value: TicketSource | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'All sources', emoji: '🔍' },
  { value: 'call', label: 'Call', emoji: '📞' },
  { value: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
  { value: 'email', label: 'Email', emoji: '✉️' },
  { value: 'linkedin', label: 'LinkedIn', emoji: '💼' },
];

export default function AgentDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<TicketSource | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [showBulkBar, setShowBulkBar] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['all-tickets', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, creator:users!created_by(id, full_name, email), assignee:users!assigned_to(id, full_name, email), ticket_tags(tag:tags(*))')
        .eq('company_id', user!.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
    enabled: !!user?.company_id,
    refetchInterval: 30000,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', user!.company_id)
        .in('role', ['agent', 'manager'])
        .eq('is_active', true);
      if (error) throw error;
      return data as User[];
    },
    enabled: !!user?.company_id,
  });

  useEffect(() => {
    if (!user?.company_id) return;
    const channel = supabase
      .channel('company-tickets')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tickets',
        filter: `company_id=eq.${user.company_id}`,
      }, () => { queryClient.invalidateQueries({ queryKey: ['all-tickets', user.company_id] }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.company_id, queryClient]);

  // ── Bulk actions ──────────────────────────────────────────────
  const bulkUpdate = useMutation({
    mutationFn: async () => {
      if (!bulkAction || selected.length === 0) return;
      if (bulkAction === 'assign' && bulkAssignTo) {
        const { error } = await supabase
          .from('tickets')
          .update({ assigned_to: bulkAssignTo, status: 'in_progress' })
          .in('id', selected);
        if (error) throw error;
      } else if (bulkAction === 'close') {
        const { error } = await supabase
          .from('tickets')
          .update({ status: 'solved', solved_by: user!.id, solved_at: new Date().toISOString() })
          .in('id', selected);
        if (error) throw error;
      } else if (bulkAction === 'open') {
        const { error } = await supabase
          .from('tickets')
          .update({ status: 'open', assigned_to: null })
          .in('id', selected);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSelected([]);
      setShowBulkBar(false);
      setBulkAction('');
      queryClient.invalidateQueries({ queryKey: ['all-tickets', user?.company_id] });
    },
  });

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === filtered?.length) {
      setSelected([]);
    } else {
      setSelected(filtered?.map(t => t.id) || []);
    }
  };

  const filtered = tickets?.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.contact_name?.toLowerCase().includes(q) ||
        t.contact_mobile?.includes(q) ||
        t.summary?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── SLA status helper ─────────────────────────────────────────
  const getSLAStatus = (ticket: Ticket) => {
    if (!ticket.sla_resolve_due) return null;
    const due = new Date(ticket.sla_resolve_due).getTime();
    const now = Date.now();
    const diff = due - now;
    const hours = Math.floor(diff / 3600000);
    if (ticket.status === 'solved') return null;
    if (diff < 0) return { label: 'SLA Breached', cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30' };
    if (hours < 2) return { label: `SLA: ${hours}h left`, cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' };
    return { label: `SLA: ${hours}h left`, cls: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30' };
  };

  const stats = tickets ? [
    { label: 'Total', value: tickets.length },
    { label: 'Open', value: tickets.filter(t => t.status === 'open').length, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'in_progress').length, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Solved today', value: tickets.filter(t => t.status === 'solved' && t.solved_at && new Date(t.solved_at).toDateString() === new Date().toDateString()).length, color: 'text-green-600 dark:text-green-400' },
  ] : [];

  const basePath = user?.role === 'manager' ? 'manager' : 'agent';

  return (
    <div>
      <PageHeader
        title="Ticket Dashboard"
        subtitle="Manage and resolve incoming tickets"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkBar(!showBulkBar)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${showBulkBar ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
            >
              ☑ Bulk
            </button>
            <Link to={`/desk/${basePath}/tickets/new`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
              + New ticket
            </Link>
          </div>
        }
      />

      {tickets && <StatsRow stats={stats} />}

      {/* ── Bulk action bar ── */}
      {showBulkBar && (
        <div className="mx-4 md:mx-6 mb-3 p-3 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl flex flex-wrap items-center gap-2">
          <button onClick={toggleSelectAll} className="text-xs font-medium text-violet-700 dark:text-violet-300 underline">
            {selected.length === filtered?.length ? 'Deselect all' : `Select all (${filtered?.length})`}
          </button>
          <span className="text-xs text-violet-600 dark:text-violet-400">{selected.length} selected</span>
          <div className="flex-1" />
          <select
            value={bulkAction}
            onChange={e => setBulkAction(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="">Choose action…</option>
            <option value="close">Mark as Solved</option>
            <option value="open">Reopen</option>
            <option value="assign">Assign to agent</option>
          </select>
          {bulkAction === 'assign' && (
            <select
              value={bulkAssignTo}
              onChange={e => setBulkAssignTo(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="">Select agent…</option>
              {agents?.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}
          <button
            onClick={() => bulkUpdate.mutate()}
            disabled={!bulkAction || selected.length === 0 || bulkUpdate.isPending}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            {bulkUpdate.isPending ? 'Applying…' : 'Apply'}
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="px-4 md:px-6 pb-4 space-y-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, mobile, or summary…"
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
        />
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === f.value ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500">
            {sourceFilters.map((f) => <option key={f.value} value={f.value}>{f.emoji} {f.label}</option>)}
          </select>
        </div>
        {!isLoading && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {filtered?.length} ticket{filtered?.length !== 1 ? 's' : ''}
            {(statusFilter !== 'all' || sourceFilter !== 'all' || search) ? ' (filtered)' : ''}
          </p>
        )}
      </div>

      {/* ── Ticket list ── */}
      <div className="px-4 md:px-6 pb-8 space-y-3">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <TicketSkeleton key={i} />)}
        {!isLoading && filtered?.length === 0 && <EmptyState message="No tickets match your filters" />}
        {filtered?.map((ticket) => {
          const sla = getSLAStatus(ticket);
          const isSelected = selected.includes(ticket.id);
          return (
            <div key={ticket.id} className={`relative ${isSelected ? 'ring-2 ring-violet-500 rounded-xl' : ''}`}>
              {showBulkBar && (
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(ticket.id)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                  />
                </div>
              )}
              <div className={showBulkBar ? 'pl-8' : ''}>
                <TicketCard
                  ticket={ticket}
                  showAssignee
                  onClick={() => !showBulkBar && navigate(`/desk/${basePath}/tickets/${ticket.id}`)}
                  extraBadge={sla ? (
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${sla.cls}`}>{sla.label}</span>
                  ) : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}