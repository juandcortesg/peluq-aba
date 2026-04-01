import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { InventoryItem, InventoryMovement } from '../../models/inventory';

@Component({
  selector: 'app-inventory-form',
  templateUrl: './inventory-form.component.html',
  styleUrls: ['./inventory-form.component.scss']
})
export class InventoryFormComponent implements OnChanges {
  @Input() inventoryItems: InventoryItem[] = [];
  @Input() itemToEdit: InventoryItem | null = null;
  @Input() movementToEdit: InventoryMovement | null = null;
  @Output() inventoryUpdated = new EventEmitter<void>();
  @Output() itemEditCancelled = new EventEmitter<void>();
  @Output() movementEditCancelled = new EventEmitter<void>();

  itemForm: FormGroup;
  movementForm: FormGroup;

  isSavingItem = false;
  isSavingMovement = false;

  itemSubmitError = '';
  movementSubmitError = '';

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {
    this.itemForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
      category: ['Insumos', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]],
      unit: ['unidades', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
      currentStock: [0, [Validators.required, Validators.min(0)]],
      minStock: [5, [Validators.required, Validators.min(0)]],
      notes: ['', [Validators.maxLength(280)]]
    });

    this.movementForm = this.fb.group({
      inventoryItemId: ['', [Validators.required]],
      movementType: ['entry', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
      referenceLabel: ['', [Validators.maxLength(80)]],
      movementDate: [this.todayDateValue(), [Validators.required]],
      notes: ['', [Validators.maxLength(280)]]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inventoryItems']) {
      const selectedId = this.movementControls['inventoryItemId'].value as string;
      const stillExists = this.inventoryItems.some((item) => item.id === selectedId);

      if (!selectedId || !stillExists) {
        this.movementForm.patchValue({
          inventoryItemId: this.inventoryItems[0]?.id || ''
        }, { emitEvent: false });
      }
    }

    if (changes['itemToEdit']) {
      this.applyItemEditingState();
    }

    if (changes['movementToEdit']) {
      this.applyMovementEditingState();
    }
  }

  get itemControls() {
    return this.itemForm.controls;
  }

  get movementControls() {
    return this.movementForm.controls;
  }

  get selectedInventoryItem(): InventoryItem | null {
    const selectedId = this.movementControls['inventoryItemId'].value as string;
    return this.inventoryItems.find((item) => item.id === selectedId) || null;
  }

  get movementNotesLength(): number {
    return (this.movementControls['notes'].value as string)?.length || 0;
  }

  get itemNotesLength(): number {
    return (this.itemControls['notes'].value as string)?.length || 0;
  }

  get isEditingItem(): boolean {
    return !!this.itemToEdit;
  }

  get isEditingMovement(): boolean {
    return !!this.movementToEdit;
  }

  get itemHeadingLabel(): string {
    return this.isEditingItem ? 'Editar item' : 'Nuevo item';
  }

  get itemHeadingTitle(): string {
    return this.isEditingItem ? 'Actualizar producto o insumo' : 'Registrar producto o insumo';
  }

  get movementHeadingLabel(): string {
    return this.isEditingMovement ? 'Editar movimiento' : 'Movimiento';
  }

  get movementHeadingTitle(): string {
    return this.isEditingMovement ? 'Actualizar entrada o salida' : 'Registrar entrada o salida';
  }

  get projectedStock(): number | null {
    const selectedItem = this.selectedInventoryItem;

    if (!selectedItem) {
      return null;
    }

    const quantity = Math.max(0, Number(this.movementControls['quantity'].value) || 0);
    const movementType = this.movementControls['movementType'].value as 'entry' | 'exit';

    return movementType === 'exit'
      ? selectedItem.current_stock - quantity
      : selectedItem.current_stock + quantity;
  }

  get projectedStockLabel(): string {
    const projectedStock = this.projectedStock;
    const unit = this.selectedInventoryItem?.unit || 'unidades';

    if (projectedStock === null) {
      return 'Selecciona un item para ver el stock proyectado.';
    }

    return `Stock proyectado: ${this.formatQuantity(projectedStock)} ${unit}`;
  }

  async onSubmitItem(): Promise<void> {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }

    this.isSavingItem = true;
    this.itemSubmitError = '';

    try {
      const { name, category, unit, currentStock, minStock, notes } = this.itemForm.getRawValue();

      let savedItem: InventoryItem;

      if (this.itemToEdit) {
        savedItem = await this.supabaseService.updateInventoryItem(this.itemToEdit.id, {
          name,
          category,
          unit,
          current_stock: Number(currentStock),
          min_stock: Number(minStock),
          notes
        });
        this.notificationService.success('Item actualizado', `"${savedItem.name}" fue actualizado en el inventario.`);
      } else {
        savedItem = await this.supabaseService.addInventoryItem({
          name,
          category,
          unit,
          current_stock: Number(currentStock),
          min_stock: Number(minStock),
          notes
        });
        this.notificationService.success('Item creado', `"${savedItem.name}" ya hace parte del inventario.`);
      }

      this.resetItemForm(category || 'Insumos', unit || 'unidades', Number(minStock) || 5);

      this.movementForm.patchValue({
        inventoryItemId: savedItem.id
      });

      this.inventoryUpdated.emit();
    } catch (error) {
      console.error(error);
      this.itemSubmitError = error instanceof Error
        ? error.message
        : 'Ocurrio un error al guardar el item del inventario.';
      this.notificationService.error('No se pudo guardar', this.itemSubmitError);
    } finally {
      this.isSavingItem = false;
    }
  }

  async onSubmitMovement(): Promise<void> {
    if (!this.inventoryItems.length) {
      this.notificationService.warning('Primero crea un item', 'Necesitas al menos un item para registrar entradas o salidas.');
      return;
    }

    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    this.isSavingMovement = true;
    this.movementSubmitError = '';

    try {
      const {
        inventoryItemId,
        movementType,
        quantity,
        reason,
        referenceLabel,
        movementDate,
        notes
      } = this.movementForm.getRawValue();

      if (this.movementToEdit) {
        await this.supabaseService.updateInventoryMovement(this.movementToEdit.id, {
          inventory_item_id: inventoryItemId,
          movement_type: movementType,
          quantity: Number(quantity),
          reason,
          reference_label: referenceLabel,
          movement_date: movementDate,
          notes
        });
        this.notificationService.success('Movimiento actualizado', 'La entrada o salida fue actualizada correctamente.');
      } else {
        await this.supabaseService.addInventoryMovement({
          inventory_item_id: inventoryItemId,
          movement_type: movementType,
          quantity: Number(quantity),
          reason,
          reference_label: referenceLabel,
          movement_date: movementDate,
          notes
        });
        this.notificationService.success('Movimiento registrado', 'La entrada o salida quedo guardada con trazabilidad.');
      }

      this.resetMovementForm(inventoryItemId);

      this.inventoryUpdated.emit();
    } catch (error) {
      console.error(error);
      this.movementSubmitError = error instanceof Error
        ? error.message
        : 'Ocurrio un error al registrar el movimiento de inventario.';
      this.notificationService.error('No se pudo registrar', this.movementSubmitError);
    } finally {
      this.isSavingMovement = false;
    }
  }

  hasItemControlError(controlName: string, errorName: string): boolean {
    const control = this.itemForm.get(controlName);
    return !!control && control.hasError(errorName) && (control.touched || control.dirty);
  }

  hasMovementControlError(controlName: string, errorName: string): boolean {
    const control = this.movementForm.get(controlName);
    return !!control && control.hasError(errorName) && (control.touched || control.dirty);
  }

  cancelItemEdit(): void {
    this.resetItemForm();
    this.itemEditCancelled.emit();
  }

  cancelMovementEdit(): void {
    this.resetMovementForm();
    this.movementEditCancelled.emit();
  }

  formatQuantity(value: number): string {
    const safeValue = Number(value) || 0;
    return Number.isInteger(safeValue) ? `${safeValue}` : safeValue.toFixed(2);
  }

  private todayDateValue(): string {
    const date = new Date();
    const adjustedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjustedDate.toISOString().slice(0, 10);
  }

  private applyItemEditingState(): void {
    if (!this.itemToEdit) {
      this.resetItemForm();
      return;
    }

    this.itemForm.reset({
      name: this.itemToEdit.name,
      category: this.itemToEdit.category,
      unit: this.itemToEdit.unit,
      currentStock: Number(this.itemToEdit.current_stock),
      minStock: Number(this.itemToEdit.min_stock),
      notes: this.itemToEdit.notes || ''
    });
    this.itemSubmitError = '';
  }

  private applyMovementEditingState(): void {
    if (!this.movementToEdit) {
      this.resetMovementForm();
      return;
    }

    this.movementForm.reset({
      inventoryItemId: this.movementToEdit.inventory_item_id,
      movementType: this.movementToEdit.movement_type,
      quantity: Number(this.movementToEdit.quantity),
      reason: this.movementToEdit.reason,
      referenceLabel: this.movementToEdit.reference_label || '',
      movementDate: this.movementToEdit.movement_date,
      notes: this.movementToEdit.notes || ''
    });
    this.movementSubmitError = '';
  }

  private resetItemForm(category = 'Insumos', unit = 'unidades', minStock = 5): void {
    this.itemForm.reset({
      name: '',
      category,
      unit,
      currentStock: 0,
      minStock,
      notes: ''
    });
    this.itemSubmitError = '';
  }

  private resetMovementForm(selectedInventoryItemId?: string): void {
    this.movementForm.reset({
      inventoryItemId: selectedInventoryItemId || this.inventoryItems[0]?.id || '',
      movementType: 'entry',
      quantity: 1,
      reason: '',
      referenceLabel: '',
      movementDate: this.todayDateValue(),
      notes: ''
    });
    this.movementSubmitError = '';
  }
}
