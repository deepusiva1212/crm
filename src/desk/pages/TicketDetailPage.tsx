import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getPublicUrl } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Ticket, Comment, Tag } from '../types';
import {
  StatusBadge, PriorityBadge, SourceBadge,
  TicketCard, TicketSkeleton, EmptyState, PageHeader,
  SLABadge, TagBadge, CSATStars, ViewerAvatars
} from '../components/TicketComponents';

// ── Customer Portal ───────────────────────────────────────────
export function CustomerPortal() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['my-tickets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, assignee:users!assigned_to(full_name, email), ticket_tags(tag:tags(*))')
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
    enabled: !!user,
  });

  const stats = tickets ? [
    { label: 'Total', value: tickets.length },
    { label: 'Open', value: tickets.filter(t => t.status === 'open').length, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'in_progress').length, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Solved', value: tickets.filter(t => t.status === 'solved').length, color: 'text-green-600 dark:text-green-400' },
  ] : [];

  return (
    <div>
      <PageHeader
        title="My Tickets"
        subtitle="Track your support requests"
        action={
          <Link to="/desk/portal/tickets/new" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            + New ticket
          </Link>
        }
      />
      {tickets && tickets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 md:px-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color ?? 'text-gray-900 dark:text-white'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="p-4 md:px-6 space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <TicketSkeleton key={i} />)}
        {!isLoading && tickets?.length === 0 && (
          <EmptyState message="You haven't raised any tickets yet." action={
            <Link to="/desk/portal/tickets/new" className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
              Create your first ticket
            </Link>
          } />
        )}
        {tickets?.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} showAssignee
            onClick={() => navigate(`/desk/portal/tickets/${ticket.id}`)} />
        ))}
      </div>
    </div>
  );
}

// ── Ticket Detail ─────────────────────────────────────────────
export function TicketDetail({ basePath }: { basePath: 'portal' | 'agent' | 'manager' }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [csatRating, setCsatRating] = useState(0);
  const [csatFeedback, setCsatFeedback] = useState('');
  const [showCsat, setShowCsat] = useState(false);
  const [showTagPanel, setShowTagPanel] = useState(false);

  const canManage = user?.role === 'agent' || user?.role === 'manager';

  // ── Fetch ticket ──────────────────────────────────────────
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          creator:users!created_by(id, full_name, email, role),
          assignee:users!assigned_to(id, full_name, email, role),
          solver:users!solved_by(id, full_name, email, role),
          comments(*, author:users(id, full_name, role)),
          attachments(*),
          ticket_tags(tag:tags(*)),
          csat_responses(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Ticket;
    },
    enabled: !!id,
  });

  // ── Fetch company tags ────────────────────────────────────
  const { data: allTags } = useQuery({
    queryKey: ['tags', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', user!.company_id);
      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!user?.company_id && canManage,
  });

  // ── Fetch viewers (collision detection) ───────────────────
  const { data: viewers } = useQuery({
    queryKey: ['viewers', id],
    queryFn: async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('ticket_viewers')
        .select('*, user:users(full_name)')
        .eq('ticket_id', id)
        .neq('user_id', user!.id)
        .gte('last_seen', fiveMinAgo);
      if (error) return [];
      return data;
    },
    enabled: !!id && !!user,
    refetchInterval: 30000,
  });

  // ── Register as viewer (collision detection) ──────────────
  useEffect(() => {
    if (!id || !user) return;
    const upsertViewer = async () => {
      await supabase.from('ticket_viewers').upsert({
        ticket_id: id,
        user_id: user.id,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'ticket_id,user_id' });
    };
    upsertViewer();
    const interval = setInterval(upsertViewer, 30000);
    return () => clearInterval(interval);
  }, [id, user]);

  // ── Real-time comments ────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ticket-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comments',
        filter: `ticket_id=eq.${id}`,
      }, () => { queryClient.invalidateQueries({ queryKey: ['ticket', id] }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // ── Add comment ───────────────────────────────────────────
  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('comments').insert({
        ticket_id: id, author_id: user!.id,
        body: comment.trim(), is_internal: isInternal,
      });
      if (error) throw error;
      // Mark first response time
      if (!ticket?.first_response_at && canManage) {
        await supabase.from('tickets')
          .update({ first_response_at: new Date().toISOString() })
          .eq('id', id);
      }
    },
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  // ── Update status ─────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const updates: Record<string, any> = { status };
      if (status === 'in_progress') updates.assigned_to = user!.id;
      if (status === 'solved') {
        updates.solved_by = user!.id;
        updates.solved_at = new Date().toISOString();
        updates.sla_resolve_met = ticket?.sla_resolve_due
          ? new Date() <= new Date(ticket.sla_resolve_due) : null;
        updates.csat_sent_at = new Date().toISOString();
      }
      const { error } = await supabase.from('tickets').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
  });

  // ── Add tag ───────────────────────────────────────────────
  const addTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from('ticket_tags')
        .insert({ ticket_id: id, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
  });

  // ── Remove tag ────────────────────────────────────────────
  const removeTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from('ticket_tags')
        .delete()
        .eq('ticket_id', id)
        .eq('tag_id', tagId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
  });

  // ── Submit CSAT ───────────────────────────────────────────
  const submitCsat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('csat_responses').insert({
        ticket_id: id, rating: csatRating, feedback: csatFeedback,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowCsat(false);
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  // ── Send email notification ───────────────────────────────
  const sendEmailNotification = useMutation({
    mutationFn: async (type: 'update' | 'solved') => {
      const subject = type === 'solved'
        ? `Your ticket #${id?.slice(0, 8)} has been resolved`
        : `Update on your ticket #${id?.slice(0, 8)}`;
      const body = type === 'solved'
        ? `Dear ${ticket?.contact_name}, your support ticket has been resolved. Please rate your experience.`
        : `Dear ${ticket?.contact_name}, there is an update on your support ticket.`;
      const { error } = await supabase.from('email_logs').insert({
        ticket_id: id,
        to_email: ticket?.creator?.email,
        subject,
        body,
      });
      if (error) throw error;
      alert(`Email notification logged for ${ticket?.creator?.email}`);
    },
  });

  if (isLoading) return (
    <div className="p-4 md:p-6 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <TicketSkeleton key={i} />)}
    </div>
  );
  if (!ticket) return <div className="p-6 text-gray-500">Ticket not found</div>;

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isAudio = (mime: string) => mime.startsWith('audio/');
  const isImage = (mime: string) => mime.startsWith('image/');
  const existingTagIds = ticket.ticket_tags?.map(tt => tt.tag.id) || [];
  const availableTags = allTags?.filter(t => !existingTagIds.includes(t.id)) || [];
  const hasCsat = ticket.csat_responses && ticket.csat_responses.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-4 md:px-6 border-b border-gray-200 dark:border-gray-800">
        <Link to={`/desk/${basePath}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">←</Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono text-gray-400 dark:text-gray-500">#{ticket.id.slice(0, 8)}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <SLABadge due={ticket.sla_resolve_due} status={ticket.status} />
          </div>
          {/* Collision detection */}
          {viewers && viewers.length > 0 && (
            <div className="mt-1">
              <ViewerAvatars viewers={viewers} />
            </div>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            {ticket.status === 'open' && (
              <button onClick={() => updateStatus.mutate('in_progress')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors">
                Claim
              </button>
            )}
            {ticket.status === 'in_progress' && (
              <button onClick={() => updateStatus.mutate('solved')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors">
                Mark solved
              </button>
            )}
            <button onClick={() => sendEmailNotification.mutate('update')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors">
              📧 Notify
            </button>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 space-y-5">
        {/* ── Ticket info ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{ticket.contact_name}</h2>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm mb-4">
  <div>
    <span className="text-xs text-gray-400 dark:text-gray-500 block">Mobile</span>
    <span className="text-gray-900 dark:text-white font-medium">{ticket.contact_mobile}</span>
  </div>
  <div>
    <span className="text-xs text-gray-400 dark:text-gray-500 block">Source</span>
    <SourceBadge source={ticket.source} />
  </div>
  {(ticket as any).customer_email && (
    <div className="col-span-2">
      <span className="text-xs text-gray-400 dark:text-gray-500 block">Customer email</span>
      <a href={`mailto:${(ticket as any).customer_email}`}
        className="text-violet-600 dark:text-violet-400 hover:underline text-sm">
        {(ticket as any).customer_email}
      </a>
    </div>
  )}
</div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <span className="text-xs text-gray-400 dark:text-gray-500 block mb-2">Summary</span>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ticket.summary}</p>
          </div>
        </div>

        {/* ── Tags ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tags</h3>
            {canManage && (
              <button onClick={() => setShowTagPanel(!showTagPanel)}
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline">
                + Add tag
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ticket.ticket_tags?.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500">No tags yet</p>}
            {ticket.ticket_tags?.map(tt => (
              <div key={tt.tag.id} className="flex items-center gap-1">
                <TagBadge name={tt.tag.name} color={tt.tag.color} />
                {canManage && (
                  <button onClick={() => removeTag.mutate(tt.tag.id)}
                    className="text-gray-400 hover:text-red-500 text-xs leading-none">×</button>
                )}
              </div>
            ))}
          </div>
          {showTagPanel && (
  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
    {availableTags.length === 0 ? (
      <p className="text-xs text-gray-400 dark:text-gray-500">
        No more tags available.{' '}
        <span className="text-violet-600 dark:text-violet-400">
          Create tags in Manager → Reports → Tag Manager.
        </span>
      </p>
    ) : (
      <>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Click to add:</p>
        <div className="flex flex-wrap gap-2">
          {availableTags.map(tag => (
            <button key={tag.id} onClick={() => { addTag.mutate(tag.id); setShowTagPanel(false); }}>
              <TagBadge name={tag.name} color={tag.color} />
            </button>
          ))}
        </div>
      </>
    )}
  </div>
)}
        </div>

        {/* ── Attachments ── */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Attachments ({ticket.attachments.length})</h3>
            <div className="space-y-2">
              {ticket.attachments.map((att) => {
                const url = getPublicUrl(att.storage_path);
                return (
                  <div key={att.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    {isImage(att.mime_type) && (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={att.filename} className="w-full max-h-64 object-contain bg-gray-50 dark:bg-gray-800 cursor-pointer hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                    {isAudio(att.mime_type) && (
                      <div className="p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">🎵 {att.filename}</p>
                        <audio controls className="w-full" src={url} />
                      </div>
                    )}
                    {!isImage(att.mime_type) && !isAudio(att.mime_type) && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <span className="text-xl">📄</span>
                        <div>
                          <p className="text-xs font-medium text-gray-900 dark:text-white">{att.filename}</p>
                          <p className="text-xs text-gray-400">{(att.file_size / 1024).toFixed(1)} KB</p>
                        </div>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CSAT ── */}
        {ticket.status === 'solved' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Customer Satisfaction</h3>
            {hasCsat ? (
              <div>
                <CSATStars rating={ticket.csat_responses![0].rating} />
                {ticket.csat_responses![0].feedback && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">"{ticket.csat_responses![0].feedback}"</p>
                )}
              </div>
            ) : user?.role === 'customer' ? (
              <div>
                {!showCsat ? (
                  <button onClick={() => setShowCsat(true)}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
                    Rate your experience
                  </button>
                ) : (
                  <div className="space-y-3">
                    <CSATStars rating={csatRating} onRate={setCsatRating} />
                    <textarea
                      value={csatFeedback}
                      onChange={e => setCsatFeedback(e.target.value)}
                      placeholder="Optional feedback…"
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                    <button
                      onClick={() => csatRating > 0 && submitCsat.mutate()}
                      disabled={csatRating === 0 || submitCsat.isPending}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                      {submitCsat.isPending ? 'Submitting…' : 'Submit rating'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">No rating yet from customer</p>
            )}
          </div>
        )}

        {/* ── Comments ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Comments {ticket.comments && ticket.comments.length > 0 && `(${ticket.comments.length})`}
          </h3>
          <div className="space-y-4 mb-5">
            {ticket.comments?.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No comments yet</p>
            )}
            {ticket.comments?.map((c: Comment) => (
              <div key={c.id} className={`flex gap-3 ${c.is_internal ? 'opacity-80' : ''}`}>
                {c.is_internal && (
                  <div className="w-1 bg-amber-300 dark:bg-amber-600 rounded-full flex-shrink-0" />
                )}
                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
                  {initials(c.author?.full_name || '??')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-900 dark:text-white">{c.author?.full_name}</span>
                    {c.is_internal && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        🔒 Internal
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      {new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.body}</p>
                </div>
              </div>
            ))}
          </div>

          {ticket.status !== 'solved' && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={isInternal ? '🔒 Internal note — not visible to customer…' : 'Add a comment…'}
                rows={3}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none ${isInternal ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
              />
              <div className="flex items-center justify-between mt-2">
                {canManage && (
                  <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                    <input
                      type="checkbox" checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    🔒 Internal note
                  </label>
                )}
                <div className="ml-auto flex gap-2">
                  {canManage && (
                    <button
                      onClick={() => sendEmailNotification.mutate('update')}
                      disabled={sendEmailNotification.isPending}
                      className="px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                      📧 Send update
                    </button>
                  )}
                  <button
                    onClick={() => comment.trim() && addComment.mutate()}
                    disabled={!comment.trim() || addComment.isPending}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {addComment.isPending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}