export type TicketSource = 'call' | 'whatsapp' | 'email' | 'linkedin';
export type TicketStatus = 'open' | 'in_progress' | 'solved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type UserRole = 'customer' | 'agent' | 'manager';
export type CompanyPlan = 'free' | 'pro' | 'enterprise';

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  company?: Company;
}

export interface Ticket {
  id: string;
  company_id: string;
  created_by: string;
  assigned_to: string | null;
  solved_by: string | null;
  contact_name: string;
  contact_mobile: string;
  source: TicketSource;
  summary: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  solved_at: string | null;
  creator?: User;
  assignee?: User;
  solver?: User;
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author?: User;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  uploaded_by: string;
  storage_path: string;
  mime_type: string;
  filename: string;
  file_size: number;
  created_at: string;
  uploader?: User;
}