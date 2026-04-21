import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Ticket, TicketStatus, TicketSource } from '../types';
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

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['all-tickets', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, creator:users!created_by(id, full_name, email), assignee:users!assigned_to(id, full_name, email)')
        .eq('company_id', user!.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
    enabled: !!user?.company_id,
    refetchInterval: 30000,
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

  const claimTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: user!.id, status: 'in_progress' })
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-tickets', user?.company_id] }); },
  });

  const filtered = tickets?.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.contact_name.toLowerCase().includes(q) || t.contact_mobile.includes(q) || t.summary.toLowerCase().includes(q);
    }
    return true;
  });

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
          <Link to="/desk/portal/tickets/new" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            + New ticket
          </Link>
        }
      />

      {tickets && <StatsRow stats={stats} />}

      <div className="px-4 md:px-6 pb-4 space-y-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, mobile, or summary…"
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
        />
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === f.value ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-300 dark:hover:border-violet-700'}`}>
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
            {filtered?.length} ticket{filtered?.length !== 1 ? 's' : ''}{(statusFilter !== 'all' || sourceFilter !== 'all' || search) ? ' (filtered)' : ''}
          </p>
        )}
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-3">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <TicketSkeleton key={i} />)}
        {!isLoading && filtered?.length === 0 && <EmptyState message="No tickets match your filters" />}
        {filtered?.map((ticket) => (
          <div key={ticket.id} className="relative">
            <TicketCard ticket={ticket} showAssignee onClick={() => navigate(`/desk/${basePath}/tickets/${ticket.id}`)} />
            {ticket.status === 'open' && !ticket.assigned_to && user?.role !== 'customer' && (
              <button
                onClick={(e) => { e.stopPropagation(); claimTicket.mutate(ticket.id); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors">
                Claim
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}