import React from 'react';
import type { TicketStatus, TicketPriority, TicketSource, Ticket } from '../types';

const statusConfig: Record<TicketStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  solved: { label: 'Solved', cls: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, cls } = statusConfig[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>{label}</span>;
}

const priorityConfig: Record<TicketPriority, { label: string; cls: string; dot: string }> = {
  low: { label: 'Low', cls: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' },
  medium: { label: 'Medium', cls: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  high: { label: 'High', cls: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  urgent: { label: 'Urgent', cls: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const { label, cls, dot } = priorityConfig[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

const sourceConfig: Record<TicketSource, { emoji: string; label: string }> = {
  call: { emoji: '📞', label: 'Call' },
  whatsapp: { emoji: '💬', label: 'WhatsApp' },
  email: { emoji: '✉️', label: 'Email' },
  linkedin: { emoji: '💼', label: 'LinkedIn' },
};

export function SourceBadge({ source }: { source: TicketSource }) {
  const { emoji, label } = sourceConfig[source];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <span className="text-sm">{emoji}</span>
      {label}
    </span>
  );
}

// ── SLA Timer Badge ───────────────────────────────────────────
export function SLABadge({ due, status }: { due: string | null; status: TicketStatus }) {
  if (!due || status === 'solved') return null;
  const diff = new Date(due).getTime() - Date.now();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  if (diff < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
      ⚠ SLA Breached
    </span>
  );
  if (hours < 2) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
      ⏱ {hours}h {mins}m left
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
      ✓ SLA {hours}h left
    </span>
  );
}

// ── Tag Badge ─────────────────────────────────────────────────
export function TagBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

// ── Ticket Card ───────────────────────────────────────────────
export function TicketCard({
  ticket, onClick, showAssignee = false, extraBadge,
}: {
  ticket: Ticket;
  onClick?: () => void;
  showAssignee?: boolean;
  extraBadge?: React.ReactNode;
}) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'just now';
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-all ${onClick ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{ticket.contact_name}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{ticket.id.slice(0, 8)}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{ticket.summary}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <SourceBadge source={ticket.source} />
            <PriorityBadge priority={ticket.priority} />
            <SLABadge due={ticket.sla_resolve_due} status={ticket.status} />
            {extraBadge}
            {showAssignee && ticket.assignee && (
              <span className="text-xs text-gray-500 dark:text-gray-400">→ {ticket.assignee.full_name}</span>
            )}
            {/* Tags */}
            {ticket.ticket_tags?.map(tt => (
              <TagBadge key={tt.tag.id} name={tt.tag.name} color={tt.tag.color} />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge status={ticket.status} />
          <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(ticket.created_at)}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{ticket.contact_mobile}</span>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ message = 'No tickets found', action }: { message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">🎫</div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{message}</p>
      {action}
    </div>
  );
}

export function TicketSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
        </div>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-5 md:px-6 md:py-6 border-b border-gray-200 dark:border-gray-800">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatsRow({ stats }: { stats: { label: string; value: number | string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 md:px-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
          <p className={`text-2xl font-semibold ${s.color ?? 'text-gray-900 dark:text-white'}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── CSAT Stars ────────────────────────────────────────────────
export function CSATStars({ rating, onRate }: { rating: number; onRate?: (r: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate?.(star)}
          className={`text-2xl transition-transform hover:scale-110 ${onRate ? 'cursor-pointer' : 'cursor-default'} ${star <= rating ? 'text-amber-400' : 'text-gray-200 dark:text-gray-700'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Agent Collision Avatars ───────────────────────────────────
export function ViewerAvatars({ viewers }: { viewers: { user_id: string; user?: { full_name: string } }[] }) {
  if (!viewers || viewers.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">Also viewing:</span>
      <div className="flex -space-x-2">
        {viewers.slice(0, 5).map((v) => {
          const initials = (v.user?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div
              key={v.user_id}
              title={v.user?.full_name}
              className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300"
            >
              {initials}
            </div>
          );
        })}
      </div>
    </div>
  );
}