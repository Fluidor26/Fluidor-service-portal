export type Role =
  | 'beheerder' | 'coordinator' | 'monteur' | 'medewerker'
  | 'klant_beheerder' | 'klant_gebruiker' | 'geen';

export type TicketStatus = 'nieuw' | 'in_behandeling' | 'ingepland' | 'wacht_op_klant' | 'opgelost';
export type TicketType = 'storing' | 'onderhoud' | 'onderdelen' | 'vraag';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  customer_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  city: string | null;
  erp_number: string | null;
  contract: 'geen' | 'service_maintenance_plan';
}

export interface Location { id: string; customer_id: string; name: string; address: string | null }
export interface ProductionLine { id: string; customer_id: string; location_id: string | null; name: string; sort_order: number }

export interface Machine {
  id: string;
  customer_id: string;
  location_id: string | null;
  line_id: string | null;
  project_number: string;
  serial_number: string | null;
  name: string;
  machine_type: string | null;
  delivered_on: string | null;
  contract_start: string | null;
  next_service_on: string | null;
}

export interface Component {
  id: string;
  machine_id: string;
  article_number: string | null;
  description: string;
  quantity: number;
  is_spare_part: boolean;
}

export interface DocumentRow {
  id: string;
  machine_id: string;
  title: string;
  category: string;
  revision: string | null;
  visibility: 'intern' | 'extern';
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  number: string;
  customer_id: string;
  machine_id: string;
  type: TicketType;
  priority: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: TicketStatus;
  assignee_id: string | null;
  planned_on: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
}

export interface TicketOverview extends Ticket {
  customer_name: string;
  project_number: string;
  machine_name: string;
  serial_number: string | null;
  assignee_name: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  kind: 'bericht' | 'intern' | 'systeem';
  body: string;
  created_at: string;
}

export interface Person { id: string; full_name: string | null; is_staff: boolean }
