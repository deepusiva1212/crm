import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { notifyTicketCreated } from '../lib/email';

const ticketSchema = z.object({
  contact_name: z.string().min(1, 'Name is required'),
  contact_mobile: z.string().min(1, 'Mobile is required'),
  customer_email: z.string().email('Invalid email format').optional().or(z.literal('')),
  source: z.enum(['call', 'whatsapp', 'email', 'linkedin']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  summary: z.string().min(1, 'Summary is required'),
});

type TicketForm = z.infer<typeof ticketSchema>;

export default function NewTicketPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { source: 'call', priority: 'medium', customer_email: '' }
  });

  const selectedSource = watch('source');
  const selectedPriority = watch('priority');

  const onSubmit = async (data: TicketForm) => {
    if (!user?.company_id) return;
    setIsSubmitting(true);
    try {
      const { data: ticket, error } = await supabase.from('tickets').insert({
        company_id: user.company_id,
        created_by: user.id,
        contact_name: data.contact_name,
        contact_mobile: data.contact_mobile,
        customer_email: data.customer_email || null,
        source: data.source,
        priority: data.priority,
        summary: data.summary,
        status: 'open'
      }).select('*, company:companies(name)').single();

      if (error) throw error;

      if (data.customer_email && ticket) {
        await notifyTicketCreated({
          id: ticket.id,
          contact_name: ticket.contact_name,
          contact_mobile: ticket.contact_mobile,
          summary: ticket.summary,
          customer_email: ticket.customer_email,
          company: ticket.company
        });
      }

      const basePath = user.role === 'customer' ? 'portal' : user.role === 'manager' ? 'manager' : 'agent';
      navigate(`/desk/${basePath}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C24] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all";

  return (
    <div className="max-w-3xl mx-auto pb-10 px-4 md:px-0">
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-white mb-4">← Back</button>
        <h1 className="text-2xl font-bold text-white mb-1">New Ticket</h1>
        <p className="text-sm text-gray-400">Log a new interaction or support request</p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Contact Details Section */}
        <div className="bg-[#13131A] p-6 rounded-2xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-4">Contact details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Contact name</label>
              <input {...register('contact_name')} placeholder="John Doe" className={inputCls} />
              {errors.contact_name && <p className="mt-1 text-xs text-red-500">{errors.contact_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Mobile number</label>
              <input {...register('contact_mobile')} placeholder="+91 9876543210" className={inputCls} />
              {errors.contact_mobile && <p className="mt-1 text-xs text-red-500">{errors.contact_mobile.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Customer Email <span className="text-gray-500">(Optional - for notifications)</span></label>
            <input {...register('customer_email')} type="email" placeholder="customer@example.com" className={inputCls} />
            {errors.customer_email && <p className="mt-1 text-xs text-red-500">{errors.customer_email.message}</p>}
          </div>
        </div>

        {/* Source Section */}
        <div className="bg-[#13131A] p-6 rounded-2xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-4">Source of interaction</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { id: 'call', label: 'Phone Call', icon: '📞' },
              { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
              { id: 'email', label: 'Email', icon: '✉️' },
              { id: 'linkedin', label: 'LinkedIn', icon: '💼' }
            ].map((s) => (
              <label key={s.id} className={`cursor-pointer flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${selectedSource === s.id ? 'border-violet-500 bg-violet-500/10 text-violet-400' : 'border-gray-700 hover:border-gray-500 text-gray-400'}`}>
                <input type="radio" value={s.id} {...register('source')} className="hidden" />
                <span className="text-2xl mb-2">{s.icon}</span>
                <span className="text-xs font-medium">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority Section */}
        <div className="bg-[#13131A] p-6 rounded-2xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-4">Priority</h2>
          <div className="flex flex-wrap gap-3">
            {['low', 'medium', 'high', 'urgent'].map((p) => (
              <label key={p} className={`cursor-pointer px-5 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${selectedPriority === p ? 'border-violet-500 bg-violet-500/10 text-violet-400' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                <input type="radio" value={p} {...register('priority')} className="hidden" />
                {p}
              </label>
            ))}
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-[#13131A] p-6 rounded-2xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-4">Conversation summary</h2>
          <textarea {...register('summary')} rows={4} placeholder="Describe the conversation or issue..." className={`${inputCls} resize-none`} />
          {errors.summary && <p className="mt-1 text-xs text-red-500">{errors.summary.message}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create ticket'}
          </button>
        </div>

      </form>
    </div>
  );
}