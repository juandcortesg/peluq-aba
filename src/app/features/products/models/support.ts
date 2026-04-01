export type SupportModuleArea = 'general' | 'products' | 'services' | 'cash' | 'inventory' | 'support';
export type SupportTicketPriority = 'low' | 'medium' | 'high';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  module: SupportModuleArea;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  title: string;
  description: string;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupportTicketPayload {
  module: SupportModuleArea;
  priority: SupportTicketPriority;
  title: string;
  description: string;
}

export interface UpdateSupportTicketPayload {
  module: SupportModuleArea;
  priority: SupportTicketPriority;
  title: string;
  description: string;
  status?: SupportTicketStatus;
  resolution_note?: string | null;
}

export interface SupportAssistantContext {
  productCount: number;
  serviceCount: number;
  cashMovementCount: number;
  inventoryItemCount: number;
  lowStockCount: number;
  openTicketCount: number;
}

export interface SupportAssistantReply {
  title: string;
  answer: string;
  relatedModule: SupportModuleArea;
  suggestions: string[];
}

export interface SupportFaqItem {
  question: string;
  answer: string;
  module: SupportModuleArea;
}
