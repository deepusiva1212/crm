import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { PageHeader } from '../components/TicketComponents';
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

  const { register, handleSubmit, formState: { errors } } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { source: 'call', priority: 'medium', customer_email: '' }
  });

  const onSubmit = async (data: TicketForm) => {
    if (!user?.company_id) return;
    setIsSubmitting(true);
    
    try {
      // 1. Save ticket to database
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

      // 2. Send automated email if an email was provided
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

      // 3. Route back to correct dashboard
      const basePath = user.role === 'customer' ? 'portal' : user.role === 'manager' ? 'manager' : 'agent';
      navigate(`/desk/${basePath}`);
      
    } catch (err) {
      console.error(err);
      alert('Failed to create ticket. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all";

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <PageHeader title="New Ticket" subtitle="Log a new interaction or support request" />
      
      <div className="px-4 md:px-6 mt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white dark:bg-gray-900 p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Contact Name</label>
              <input {...register('contact_name')} placeholder="John Doe" className={inputCls} />
              {errors.contact_name && <p className="mt-1 text-xs text-red-500">{errors.contact_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Mobile Number</label>
              <input {...register('contact_mobile')} placeholder="+91 9876543210" className={inputCls} />
              {errors.contact_mobile && <p className="mt-1 text-xs text-red-500">{errors.contact_mobile.message}</p>}
            </div>
            
            {/* THIS IS THE NEW EMAIL BOX */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Customer Email <span className="text-gray-400 font-normal">(Optional - for notifications)</span>
              </label>
              <input {...register('customer_email')} type="email" placeholder="customer@example.com" className={inputCls} />
              {errors.customer_email && <p className="mt-1 text-xs text-red-500">{errors.customer_email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Source</label>
              <select {...register('source')} className={inputCls}>
                <option value="call">Phone Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Priority</label>
              <select {...register('priority')} className={inputCls}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Conversation Summary</label>
            <textarea {...register('summary')} rows={4} placeholder="Describe the conversation or issue..." className={`${inputCls} resize-none`} />
            {errors.summary && <p className="mt-1 text-xs text-red-500">{errors.summary.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {isSubmitting ? 'Creating...' : 'Create ticket'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}