export interface Product {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  created_at: string;
}

export interface CreateProductPayload {
  name: string;
  price: number;
  description?: string | null;
}

export interface SalonService {
  id: string;
  category: string;
  badge: string | null;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  created_at: string;
}

export interface CreateSalonServicePayload {
  category: string;
  badge?: string | null;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number;
}
