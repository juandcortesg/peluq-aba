import { Injectable } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import {
  CreateProductPayload,
  CreateSalonServicePayload,
  Product,
  SalonService
} from '../../features/products/models/product';
import { CashMovement, CreateCashMovementPayload } from '../../features/products/models/cash';
import {
  CreateInventoryItemPayload,
  CreateInventoryMovementPayload,
  InventoryItem,
  InventoryMovement
} from '../../features/products/models/inventory';
import {
  CreateSupportTicketPayload,
  SupportTicket,
  SupportTicketStatus,
  UpdateSupportTicketPayload
} from '../../features/products/models/support';

export const DEFAULT_PRODUCT_IMAGE = 'assets/images/product-placeholder.svg';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly supabase: SupabaseClient;
  private readonly bucketName = environment.supabaseBucket;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  getAdminEmail(): string {
    return `${environment.supabaseAdminEmail || ''}`.trim().toLowerCase();
  }

  isAdminEmail(email: string | null | undefined): boolean {
    return !!email && email.toLowerCase() === this.getAdminEmail();
  }

  async sendAdminAccessLink(): Promise<void> {
    this.ensureConfiguration();
    this.ensureAdminConfiguration();

    const { error } = await this.supabase.auth.signInWithOtp({
      email: this.getAdminEmail(),
      options: {
        emailRedirectTo: this.getAuthRedirectUrl()
      }
    });

    if (error) {
      throw new Error('No se pudo enviar el enlace de acceso del administrador.');
    }
  }

  async getAuthenticatedEmail(): Promise<string | null> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase.auth.getSession();

    if (error) {
      throw new Error('No se pudo verificar la sesion actual.');
    }

    return data.session?.user?.email?.toLowerCase() || null;
  }

  onAuthEmailChange(callback: (email: string | null) => void): { unsubscribe(): void } {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      callback(session?.user?.email?.toLowerCase() || null);
    });

    return data.subscription;
  }

  async signOut(): Promise<void> {
    this.ensureConfiguration();

    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw new Error('No se pudo cerrar la sesion del administrador.');
    }
  }

  async getProducts(): Promise<Product[]> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('products')
      .select('id, name, price, description, image_url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar los productos desde Supabase.');
    }

    return (data ?? []).map((product) => this.withFallbackImage(product as Product));
  }

  async getServices(): Promise<SalonService[]> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('services')
      .select('id, category, badge, name, description, duration_minutes, price, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar los servicios desde Supabase.');
    }

    return (data ?? []) as SalonService[];
  }

  async getCashMovements(): Promise<CashMovement[]> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('cash_movements')
      .select('id, type, category, concept, amount, movement_date, notes, created_at')
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar los movimientos de caja.');
    }

    return (data ?? []) as CashMovement[];
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('id, name, category, unit, current_stock, min_stock, notes, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar los items del inventario.');
    }

    return (data ?? []) as InventoryItem[];
  }

  async getInventoryMovements(): Promise<InventoryMovement[]> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('inventory_movements')
      .select(`
        id,
        inventory_item_id,
        movement_type,
        quantity,
        reason,
        reference_label,
        notes,
        movement_date,
        created_at,
        inventory_items (
          name,
          category,
          unit
        )
      `)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar los movimientos de inventario.');
    }

    return (data ?? []).map((movement) => this.mapInventoryMovement(movement));
  }

  async getSupportTickets(): Promise<SupportTicket[]> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('support_tickets')
      .select('id, module, priority, status, title, description, resolution_note, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar los tickets de soporte.');
    }

    return (data ?? []) as SupportTicket[];
  }

  async addProduct(product: CreateProductPayload, imageFile?: File | null): Promise<Product> {
    this.ensureConfiguration();

    let imageUrl = DEFAULT_PRODUCT_IMAGE;

    if (imageFile) {
      const uploadResult = await this.uploadProductImage(imageFile);
      imageUrl = uploadResult.imageUrl;
    }

    const { data, error } = await this.supabase
      .from('products')
      .insert({
        name: product.name.trim(),
        price: Number(product.price),
        description: product.description?.trim() || null,
        image_url: imageUrl
      })
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo guardar el producto en Supabase.');
    }

    return this.withFallbackImage(data as Product);
  }

  async updateProduct(
    product: Product,
    payload: CreateProductPayload,
    imageFile?: File | null,
    removeCurrentImage = false
  ): Promise<Product> {
    this.ensureConfiguration();

    let imageUrl = product.image_url || DEFAULT_PRODUCT_IMAGE;
    const previousImagePath = this.extractStoragePath(product.image_url);

    if (imageFile) {
      const uploadResult = await this.uploadProductImage(imageFile);
      imageUrl = uploadResult.imageUrl;
    } else if (removeCurrentImage) {
      imageUrl = DEFAULT_PRODUCT_IMAGE;
    }

    const { data, error } = await this.supabase
      .from('products')
      .update({
        name: payload.name.trim(),
        price: Number(payload.price),
        description: payload.description?.trim() || null,
        image_url: imageUrl
      })
      .eq('id', product.id)
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo actualizar el producto en Supabase.');
    }

    if ((imageFile || removeCurrentImage) && previousImagePath && imageUrl !== product.image_url) {
      const { error: storageError } = await this.supabase.storage
        .from(this.bucketName)
        .remove([previousImagePath]);

      if (storageError) {
        console.warn('No se pudo eliminar la imagen anterior del producto.', storageError);
      }
    }

    return this.withFallbackImage(data as Product);
  }

  async deleteProduct(product: Product): Promise<void> {
    this.ensureConfiguration();

    const { error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (error) {
      throw new Error('No se pudo eliminar el producto.');
    }

    const imagePath = this.extractStoragePath(product.image_url);

    if (imagePath) {
      const { error: storageError } = await this.supabase.storage
        .from(this.bucketName)
        .remove([imagePath]);

      if (storageError) {
        console.warn('No se pudo eliminar la imagen del almacenamiento.', storageError);
      }
    }
  }

  async addService(service: CreateSalonServicePayload): Promise<SalonService> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('services')
      .insert({
        category: service.category.trim(),
        badge: service.badge?.trim() || null,
        name: service.name.trim(),
        description: service.description?.trim() || null,
        duration_minutes: Number(service.duration_minutes),
        price: Number(service.price)
      })
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo guardar el servicio en Supabase.');
    }

    return data as SalonService;
  }

  async updateService(serviceId: string, service: CreateSalonServicePayload): Promise<SalonService> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('services')
      .update({
        category: service.category.trim(),
        badge: service.badge?.trim() || null,
        name: service.name.trim(),
        description: service.description?.trim() || null,
        duration_minutes: Number(service.duration_minutes),
        price: Number(service.price)
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo actualizar el servicio en Supabase.');
    }

    return data as SalonService;
  }

  async addCashMovement(movement: CreateCashMovementPayload): Promise<CashMovement> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('cash_movements')
      .insert({
        type: movement.type,
        category: movement.category.trim(),
        concept: movement.concept.trim(),
        amount: Number(movement.amount),
        movement_date: movement.movement_date,
        notes: movement.notes?.trim() || null
      })
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo guardar el movimiento de caja.');
    }

    return data as CashMovement;
  }

  async updateCashMovement(movementId: string, movement: CreateCashMovementPayload): Promise<CashMovement> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('cash_movements')
      .update({
        type: movement.type,
        category: movement.category.trim(),
        concept: movement.concept.trim(),
        amount: Number(movement.amount),
        movement_date: movement.movement_date,
        notes: movement.notes?.trim() || null
      })
      .eq('id', movementId)
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo actualizar el movimiento de caja.');
    }

    return data as CashMovement;
  }

  async addInventoryItem(item: CreateInventoryItemPayload): Promise<InventoryItem> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('inventory_items')
      .insert({
        name: item.name.trim(),
        category: item.category.trim(),
        unit: item.unit.trim(),
        current_stock: Number(item.current_stock),
        min_stock: Number(item.min_stock),
        notes: item.notes?.trim() || null
      })
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo guardar el item del inventario.');
    }

    return data as InventoryItem;
  }

  async updateInventoryItem(itemId: string, item: CreateInventoryItemPayload): Promise<InventoryItem> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('inventory_items')
      .update({
        name: item.name.trim(),
        category: item.category.trim(),
        unit: item.unit.trim(),
        current_stock: Number(item.current_stock),
        min_stock: Number(item.min_stock),
        notes: item.notes?.trim() || null
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'No se pudo actualizar el item del inventario.');
    }

    return data as InventoryItem;
  }

  async addInventoryMovement(movement: CreateInventoryMovementPayload): Promise<InventoryMovement> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('inventory_movements')
      .insert({
        inventory_item_id: movement.inventory_item_id,
        movement_type: movement.movement_type,
        quantity: Number(movement.quantity),
        reason: movement.reason.trim(),
        reference_label: movement.reference_label?.trim() || null,
        notes: movement.notes?.trim() || null,
        movement_date: movement.movement_date
      })
      .select(`
        id,
        inventory_item_id,
        movement_type,
        quantity,
        reason,
        reference_label,
        notes,
        movement_date,
        created_at,
        inventory_items (
          name,
          category,
          unit
        )
      `)
      .single();

    if (error) {
      throw new Error(error.message || 'No se pudo guardar el movimiento de inventario.');
    }

    return this.mapInventoryMovement(data);
  }

  async updateInventoryMovement(movementId: string, movement: CreateInventoryMovementPayload): Promise<void> {
    this.ensureConfiguration();

    const { error } = await this.supabase.rpc('update_inventory_movement', {
      p_movement_id: movementId,
      p_inventory_item_id: movement.inventory_item_id,
      p_movement_type: movement.movement_type,
      p_quantity: Number(movement.quantity),
      p_reason: movement.reason.trim(),
      p_reference_label: movement.reference_label?.trim() || null,
      p_notes: movement.notes?.trim() || null,
      p_movement_date: movement.movement_date
    });

    if (error) {
      throw new Error(error.message || 'No se pudo actualizar el movimiento de inventario.');
    }
  }

  async addSupportTicket(ticket: CreateSupportTicketPayload): Promise<SupportTicket> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('support_tickets')
      .insert({
        module: ticket.module,
        priority: ticket.priority,
        status: 'open',
        title: ticket.title.trim(),
        description: ticket.description.trim()
      })
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo guardar el ticket de soporte.');
    }

    return data as SupportTicket;
  }

  async updateSupportTicket(ticketId: string, ticket: UpdateSupportTicketPayload): Promise<SupportTicket> {
    this.ensureConfiguration();

    const { data, error } = await this.supabase
      .from('support_tickets')
      .update({
        module: ticket.module,
        priority: ticket.priority,
        title: ticket.title.trim(),
        description: ticket.description.trim(),
        status: ticket.status,
        resolution_note: ticket.resolution_note?.trim() || null
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo actualizar el ticket de soporte.');
    }

    return data as SupportTicket;
  }

  async deleteService(serviceId: string): Promise<void> {
    this.ensureConfiguration();

    const { error } = await this.supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      throw new Error('No se pudo eliminar el servicio.');
    }
  }

  async deleteCashMovement(movementId: string): Promise<void> {
    this.ensureConfiguration();

    const { error } = await this.supabase
      .from('cash_movements')
      .delete()
      .eq('id', movementId);

    if (error) {
      throw new Error('No se pudo eliminar el movimiento de caja.');
    }
  }

  async deleteInventoryMovement(movementId: string): Promise<void> {
    this.ensureConfiguration();

    const { error } = await this.supabase
      .from('inventory_movements')
      .delete()
      .eq('id', movementId);

    if (error) {
      throw new Error(error.message || 'No se pudo eliminar el movimiento de inventario.');
    }
  }

  async updateSupportTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
    resolutionNote?: string | null
  ): Promise<void> {
    this.ensureConfiguration();

    const payload: { status: SupportTicketStatus; resolution_note?: string | null } = { status };

    if (status === 'resolved') {
      payload.resolution_note = resolutionNote?.trim() || 'Caso revisado y marcado como resuelto.';
    } else if (status === 'open') {
      payload.resolution_note = null;
    }

    const { error } = await this.supabase
      .from('support_tickets')
      .update(payload)
      .eq('id', ticketId);

    if (error) {
      throw new Error('No se pudo actualizar el estado del ticket.');
    }
  }

  private async uploadProductImage(imageFile: File): Promise<{ imagePath: string; imageUrl: string }> {
    const fileExtension = imageFile.name.split('.').pop() || 'jpg';
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const imagePath = `products/${Date.now()}-${randomId}.${fileExtension}`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucketName)
      .upload(imagePath, imageFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error('No se pudo subir la imagen del producto.');
    }

    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(imagePath);

    return {
      imagePath,
      imageUrl: data.publicUrl
    };
  }

  private withFallbackImage(product: Product): Product {
    return {
      ...product,
      image_url: product.image_url || DEFAULT_PRODUCT_IMAGE,
      image_path: this.extractStoragePath(product.image_url),
      description: product.description || null
    };
  }

  private mapInventoryMovement(movement: any): InventoryMovement {
    const relatedItem = Array.isArray(movement.inventory_items)
      ? movement.inventory_items[0]
      : movement.inventory_items;

    return {
      id: movement.id,
      inventory_item_id: movement.inventory_item_id,
      movement_type: movement.movement_type,
      quantity: Number(movement.quantity),
      reason: movement.reason,
      reference_label: movement.reference_label || null,
      notes: movement.notes || null,
      movement_date: movement.movement_date,
      created_at: movement.created_at,
      item_name: relatedItem?.name || 'Item sin nombre',
      item_category: relatedItem?.category || 'Sin categoria',
      item_unit: relatedItem?.unit || 'unidades'
    };
  }

  private extractStoragePath(imageUrl: string | null): string | null {
    if (!imageUrl || imageUrl === DEFAULT_PRODUCT_IMAGE) {
      return null;
    }

    const storageSegment = `/storage/v1/object/public/${this.bucketName}/`;
    const imagePathIndex = imageUrl.indexOf(storageSegment);

    if (imagePathIndex === -1) {
      return null;
    }

    return decodeURIComponent(imageUrl.slice(imagePathIndex + storageSegment.length));
  }

  private ensureConfiguration(): void {
    if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
      throw new Error('Configura tu URL y clave publica de Supabase en los environments.');
    }
  }

  private ensureAdminConfiguration(): void {
    if (!this.getAdminEmail()) {
      throw new Error('Configura el correo del administrador en los environments.');
    }
  }

  private getAuthRedirectUrl(): string | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return `${window.location.origin}${window.location.pathname}`;
  }
}
