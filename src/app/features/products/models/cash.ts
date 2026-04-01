export type CashMovementType = 'income' | 'expense';
export type CashPeriodPreset = 'today' | 'month' | 'custom';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  category: string;
  concept: string;
  amount: number;
  movement_date: string;
  notes: string | null;
  created_at: string;
}

export interface CreateCashMovementPayload {
  type: CashMovementType;
  category: string;
  concept: string;
  amount: number;
  movement_date: string;
  notes?: string | null;
}

export interface CashTrendPoint {
  label: string;
  income: number;
  expense: number;
}

export interface CashInsight {
  title: string;
  description: string;
  level: 'good' | 'warning' | 'neutral';
}
