import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

interface SendEmailParams {
  type: 'ticket_created' | 'agent_reply' | 'ticket_solved' | 'ticket_assigned';
  to_email: string;
  to_name: string;
  ticket_id: string;
  ticket_short_id: string;
  contact_name: string;
  summary?: string;
  agent_name?: string;
  comment?: string;
  company_name?: string;
}

export async function sendEmail(params: SendEmailParams) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const csat_url = `${window.location.origin}/desk/portal/tickets/${params.ticket_id}?csat=true`;
    
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ ...params, csat_url }),
    });
    
    if (!res.ok) throw new Error('Email send failed');
    return true;
  } catch (err) {
    console.error('Email error:', err);
    return false;
  }
}

export async function notifyTicketCreated(ticket: {
  id: string;
  contact_name: string;
  contact_mobile: string;
  summary: string;
  customer_email?: string;
  company?: { name: string };
}) {
  if (!ticket.customer_email) return;
  return sendEmail({
    type: 'ticket_created',
    to_email: ticket.customer_email,
    to_name: ticket.contact_name,
    ticket_id: ticket.id,
    ticket_short_id: ticket.id.slice(0, 8).toUpperCase(),
    contact_name: ticket.contact_name,
    summary: ticket.summary,
    company_name: ticket.company?.name,
  });
}