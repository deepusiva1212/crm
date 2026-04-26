import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase, uploadAttachment } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { notifyTicketCreated } from '../lib/email';
import type { TicketSource, TicketPriority } from '../types';

const schema = z.object({
  contact_name: z.string().min(2, 'Enter contact name'),
  contact_mobile: z.string().min(10, 'Enter valid mobile number'),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
  source: z.enum(['call', 'whatsapp', 'email', 'linkedin']),
  summary: z.string().min(10, 'Please provide a summary (min 10 chars)'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});
type FormData = z.infer<typeof schema>;

const sources: { value: TicketSource; label: string; emoji: string; color: string }[] = [
  { value: 'call', label: 'Phone Call', emoji: '📞', color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' },
  { value: 'whatsapp', label: 'WhatsApp', emoji: '💬', color: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' },
  { value: 'email', label: 'Email', emoji: '✉️', color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' },
  { value: 'linkedin', label: 'LinkedIn', emoji: '💼', color: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300' },
];

const priorities: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'high', label: 'High', color: 'text-amber-600 dark:text-amber-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600 dark:text-red-400' },
];

function FileDropZone({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);

  const isValidFile = (f: File) =>
    ['audio/mpeg', 'audio/wav', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(isValidFile);
    onChange([...files, ...dropped]);
  }, [files, onChange]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(isValidFile);
    onChange([...files, ...selected]);
  };

  const removeFile = (i: number) => onChange(files.filter((_, idx) => idx !== i));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (f: File) => {
    if (f.type.startsWith('audio/')) return '🎵';
    if (f.type.startsWith('image/')) return '🖼️';
    return '📄';
  };

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragging ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20' : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'}`}
      >
        <input type="file" multiple className="hidden" accept=".mp3,.wav,.jpg,.jpeg,.png,.webp,.pdf" onChange={handleInput} />
        <div className="text-2xl mb-2">📎</div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop files here or click to upload</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Voice recordings (.mp3, .wav), screenshots (.jpg, .png), PDFs</p>
      </label>
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <span className="text-lg leading-none">{fileIcon(file)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
              <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NewTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'call', priority: 'medium' },
  });

  const selectedSource = watch('source');
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all";

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setServerError('');
    setUploading(true);
    try {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          company_id: user.company_id,
          created_by: user.id,
          contact_name: data.contact_name,
          contact_mobile: data.contact_mobile,
          customer_email: data.customer_email || null,
          source: data.source,
          summary: data.summary,
          priority: data.priority,
          status: 'open',
        })
        .select('*, company:companies(*)')
        .single();
      if (ticketError) throw ticketError;

      // Upload attachments
      for (const file of attachments) {
        const storagePath = await uploadAttachment(ticket.id, file, user.id);
        await supabase.from('attachments').insert({
          ticket_id: ticket.id,
          uploaded_by: user.id,
          storage_path: storagePath,
          mime_type: file.type,
          filename: file.name,
          file_size: file.size,
        });
      }

      // Send email notification
      if (data.customer_email) {
        await notifyTicketCreated({
          ...ticket,
          customer_email: data.customer_email,
        });
      }

      const basePath = user.role === 'customer'
        ? `/desk/portal/tickets/${ticket.id}`
        : user.role === 'agent'
          ? `/desk/agent/tickets/${ticket.id}`
          : `/desk/manager/tickets/${ticket.id}`;
      navigate(basePath);
    } catch (err: any) {
      setServerError(err.message || 'Failed to create ticket.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3 transition-colors">← Back</button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">New Ticket</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Log a new interaction or support request</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Contact details */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Contact details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Contact name</label>
              <input {...register('contact_name')} type="text" placeholder="John Doe" className={inputCls} />
              {errors.contact_name && <p className="mt-1 text-xs text-red-500">{errors.contact_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Mobile number</label>
              <input {...register('contact_mobile')} type="tel" placeholder="+91 9876543210" className={inputCls} />
              {errors.contact_mobile && <p className="mt-1 text-xs text-red-500">{errors.contact_mobile.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Customer email <span className="text-gray-400 font-normal">(for notifications)</span>
              </label>
              <input {...register('customer_email')} type="email" placeholder="customer@example.com" className={inputCls} />
              {errors.customer_email && <p className="mt-1 text-xs text-red-500">{errors.customer_email.message}</p>}
            </div>
          </div>
        </div>

        {/* Source */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Source of interaction</h2>
          <Controller name="source" control={control} render={({ field }) => (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {sources.map((s) => (
                <button key={s.value} type="button" onClick={() => field.onChange(s.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${field.value === s.value ? `${s.color} border-current` : 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400'}`}>
                  <span className="text-2xl">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          )} />
        </div>

        {/* Priority */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Priority</h2>
          <Controller name="priority" control={control} render={({ field }) => (
            <div className="flex gap-2 flex-wrap">
              {priorities.map((p) => (
                <button key={p.value} type="button" onClick={() => field.onChange(p.value)}
                  className={`px-4 py-2 rounded-lg border text-xs font-semibold capitalize transition-all ${field.value === p.value ? `${p.color} border-current bg-current/5` : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )} />
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Conversation summary</h2>
          <textarea {...register('summary')} rows={5}
            placeholder="Describe the conversation, what was discussed, any action items..."
            className={`${inputCls} resize-none`} />
          {errors.summary && <p className="mt-1 text-xs text-red-500">{errors.summary.message}</p>}
        </div>

        {/* Attachments — RESTORED */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Attachments</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            {selectedSource === 'call' ? 'Attach voice recordings (.mp3, .wav)'
              : selectedSource === 'whatsapp' ? 'Attach screenshots (.jpg, .png)'
              : 'Attach any relevant files'}
          </p>
          <FileDropZone files={attachments} onChange={setAttachments} />
        </div>

        {serverError && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
          </div>
        )}

        <div className="flex gap-3 pb-4">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || uploading}
            className="flex-1 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {uploading ? 'Uploading…' : isSubmitting ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}