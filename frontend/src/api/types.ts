export type Status =
  | 'requested'
  | 'employee_accepted'
  | 'employee_declined'
  | 'candidate_interested'
  | 'candidate_declined'
  | 'closed';

export type DeclineReason = 'dont_know_well' | 'not_a_fit';

export interface AppConfig {
  supabase_url: string;
  supabase_anon_key: string;
  auth_disabled: boolean;
  slack_enabled: boolean;
  app_name: string;
}

export interface EmployeeBrief {
  id: string;
  full_name: string;
  title: string;
  team: string | null;
  department: string;
}

export interface Breakdown {
  overlap?: number;
  overlap_detail?: string | null;
  school?: number;
  school_detail?: string | null;
  recency?: number;
  connected_on?: string;
  [key: string]: unknown;
}

export interface ConnectionOut {
  employee: EmployeeBrief;
  strength: number;
  shared_history: string | null;
  connected_on: string;
  breakdown: Breakdown;
}

export interface ContactBrief {
  id: string;
  full_name: string;
  headline: string;
  location: string;
  current_company: string;
  current_title: string;
  job_family: string;
  seniority: string;
  skills: string[];
}

export interface ActiveRequestBrief {
  id: string;
  status: Status;
  role_id: string;
  role_title: string;
  employee_name: string;
}

export interface Reason {
  label: string;
  detail?: string | null;
  signal?: string;
  value?: number;
}

export interface CandidateOut {
  contact: ContactBrief;
  score: number;
  reasons: Reason[];
  top_connection: ConnectionOut | null;
  connection_count: number;
  active_request: ActiveRequestBrief | null;
}

export interface CandidatePage {
  items: CandidateOut[];
  total: number;
  limit: number;
  offset: number;
}

export interface RoleScoreBrief {
  role_id: string;
  title: string;
  team: string;
  score: number;
}

export interface Experience {
  company?: string;
  title?: string;
  team?: string | null;
  start?: string | null;
  end?: string | null;
}

export interface Education {
  school?: string;
  degree?: string;
  field?: string;
  start_year?: number | null;
  end_year?: number | null;
}

export interface ContactDetail extends ContactBrief {
  linkedin_url: string;
  experiences: Experience[];
  education: Education[];
  enrichment_source: string;
  connections: ConnectionOut[];
  requests: RequestSummary[];
  top_roles: RoleScoreBrief[];
}

export interface RoleSummary {
  id: string;
  ashby_id: string;
  title: string;
  department: string;
  team: string;
  location: string;
  is_remote: boolean;
  job_family: string;
  seniority: string;
  required_skills: string[];
  published_at: string | null;
  job_url: string;
  owner_email: string | null;
  owner_name: string | null;
  is_mine: boolean;
  strong_match_count: number;
  active_request_count: number;
}

export interface RoleDetail extends RoleSummary {
  description_html: string;
  employment_type: string;
}

export interface RoleBrief {
  id: string;
  title: string;
  team: string;
  department: string;
  location: string;
  job_url: string;
  owner_email: string | null;
  owner_name: string | null;
}

export interface EventOut {
  id: string;
  from_status: Status | null;
  to_status: Status;
  actor: string;
  actor_label: string;
  note: string | null;
  created_at: string;
}

export interface MessageOut {
  id: string;
  channel: string;
  recipient: string;
  body: string;
  delivered: boolean;
  error: string | null;
  created_at: string;
  employee: EmployeeBrief;
}

export interface LastMessageBrief {
  excerpt: string;
  delivered: boolean;
  error: string | null;
  created_at: string;
  employee_name: string;
}

export interface RequestSummary {
  id: string;
  status: Status;
  status_label: string;
  contact: ContactBrief;
  role: RoleBrief;
  employee: EmployeeBrief;
  requested_by: string;
  requested_by_name: string;
  created_at: string;
  updated_at: string;
  last_event_at: string | null;
  days_waiting: number | null;
  stale: boolean;
  is_mine: boolean;
  last_message: LastMessageBrief | null;
}

export interface RequestDetail extends RequestSummary {
  outreach_casual: string;
  outreach_formal: string;
  closed_outcome: string | null;
  allowed_transitions: Status[];
  connection: ConnectionOut | null;
  /** Other connected colleagues the recruiter could ask instead, strongest first. */
  alternatives: ConnectionOut[];
  reasons: Reason[];
  events: EventOut[];
  messages: MessageOut[];
}

export interface RequestPage {
  items: RequestSummary[];
  total: number;
}

export interface CreateRequestIn {
  contact_id: string;
  role_id: string;
  employee_id?: string | null;
  /** Recruiter-edited version of the suggested message; the server falls back to its draft. */
  message?: string | null;
}

export interface AskPreviewIn {
  contact_id: string;
  role_id: string;
  employee_id?: string | null;
}

export interface AskPreviewOut {
  employee: EmployeeBrief;
  connection: ConnectionOut;
  /** The note to the employee asking for the referral; prefills the drawer's message. */
  ask: string;
  casual: string;
  formal: string;
  reasons: Reason[];
}

export interface RerouteIn {
  /** Which colleague to ask next; omitted means the strongest remaining connection. */
  employee_id?: string | null;
}

export interface TransitionIn {
  to_status: Status;
  note?: string | null;
  reason?: DeclineReason | null;
}

export interface TieredName {
  name: string;
  tier: number;
}

export interface FilterOptions {
  companies: TieredName[];
  schools: TieredName[];
  skills: string[];
  departments: string[];
  families: string[];
}

export interface StatusCount {
  status: Status;
  label: string;
  count: number;
}

export interface Stats {
  employees: number;
  contacts: number;
  connections: number;
  roles: number;
  requests_total: number;
  requests_active: number;
  by_status: StatusCount[];
  slack_enabled: boolean;
  auth_disabled: boolean;
}

export interface MeOut {
  id: string;
  email: string;
  name: string;
  auth_disabled: boolean;
}
