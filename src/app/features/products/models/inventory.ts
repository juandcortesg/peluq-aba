export type InventoryMovementType = 'entry' | 'exit';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  notes: string | null;
  created_at: string;
}

export interface CreateInventoryItemPayload {
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  notes?: string | null;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reason: string;
  reference_label: string | null;
  notes: string | null;
  movement_date: string;
  created_at: string;
  item_name: string;
  item_category: string;
  item_unit: string;
}

export interface CreateInventoryMovementPayload {
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reason: string;
  reference_label?: string | null;
  notes?: string | null;
  movement_date: string;
}
