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

export interface Tag {
  id: string;
  company_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface SLAPolicy {
  id: string;
  company_id: string;
  name: string;
  priority: TicketPriority;
  response_hours: number;
  resolve_hours: number;
}

export interface CSATResponse {
  id: string;
  ticket_id: string;
  rating: number;
  feedback: string;
  created_at: string;
}

export interface TicketViewer {
  ticket_id: string;
  user_id: string;
  last_seen: string;
  user?: User;
}

export interface AssignmentRule {
  id: string;
  company_id: string;
  name: string;
  source: TicketSource | null;
  priority: TicketPriority | null;
  assign_to: string;
  is_active: boolean;
  assignee?: User;
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
  sla_response_due: string | null;
  sla_resolve_due: string | null;
  sla_response_met: boolean | null;
  sla_resolve_met: boolean | null;
  first_response_at: string | null;
  csat_sent_at: string | null;
  tags: string[];
  creator?: User;
  assignee?: User;
  solver?: User;
  comments?: Comment[];
  attachments?: Attachment[];
  ticket_tags?: { tag: Tag }[];
  viewers?: TicketViewer[];
  csat_responses?: CSATResponse[];
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
}