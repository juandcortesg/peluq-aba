import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { CashMovement } from '../../models/cash';

@Component({
  selector: 'app-cash-form',
  templateUrl: './cash-form.component.html',
  styleUrls: ['./cash-form.component.scss']
})
export class CashFormComponent implements OnChanges {
  @Input() movementToEdit: CashMovement | null = null;
  @Output() movementAdded = new EventEmitter<void>();
  @Output() editCancelled = new EventEmitter<void>();

  cashForm: FormGroup;
  isLoading = false;
  submitError = '';

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {
    this.cashForm = this.fb.group({
      type: ['income', [Validators.required]],
      category: ['Servicios', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]],
      concept: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
      amount: [null, [Validators.required, Validators.min(0)]],
      movementDate: [this.todayDateValue(), [Validators.required]],
      notes: ['', [Validators.maxLength(280)]]
    });
  }

  get controls() {
    return this.cashForm.controls;
  }

  get descriptionLength(): number {
    return (this.controls['notes'].value as string)?.length || 0;
  }

  get movementTypeLabel(): string {
    return this.controls['type'].value === 'expense' ? 'Egreso' : 'Ingreso';
  }

  get isEditing(): boolean {
    return !!this.movementToEdit;
  }

  get headingLabel(): string {
    return this.isEditing ? 'Editar movimiento' : 'Caja diaria';
  }

  get headingTitle(): string {
    return this.isEditing ? 'Actualiza ingresos y egresos' : 'Registra ingresos y egresos';
  }

  get headingDescription(): string {
    return this.isEditing
      ? 'Modifica tipo, categoria, concepto, fecha y monto del movimiento seleccionado.'
      : 'Lleva un control financiero del salon registrando movimientos, fechas, categorias y notas de soporte.';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['movementToEdit']) {
      return;
    }

    if (!this.movementToEdit) {
      this.resetForm();
      return;
    }

    this.cashForm.reset({
      type: this.movementToEdit.type,
      category: this.movementToEdit.category,
      concept: this.movementToEdit.concept,
      amount: Number(this.movementToEdit.amount),
      movementDate: this.movementToEdit.movement_date,
      notes: this.movementToEdit.notes || ''
    });
    this.submitError = '';
  }

  async onSubmit(): Promise<void> {
    if (this.cashForm.invalid) {
      this.cashForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.submitError = '';

    try {
      const { type, category, concept, amount, movementDate, notes } = this.cashForm.getRawValue();

      if (this.movementToEdit) {
        await this.supabaseService.updateCashMovement(this.movementToEdit.id, {
          type,
          category,
          concept,
          amount: Number(amount),
          movement_date: movementDate,
          notes
        });
        this.notificationService.success('Movimiento actualizado', 'Los cambios del movimiento de caja fueron guardados.');
      } else {
        await this.supabaseService.addCashMovement({
          type,
          category,
          concept,
          amount: Number(amount),
          movement_date: movementDate,
          notes
        });
        this.notificationService.success('Movimiento registrado', 'El movimiento de caja fue guardado correctamente.');
      }

      this.resetForm();
      this.movementAdded.emit();
    } catch (error) {
      console.error(error);
      this.submitError = error instanceof Error
        ? error.message
        : 'Ocurrio un error al guardar el movimiento.';
      this.notificationService.error('No se pudo guardar', this.submitError);
    } finally {
      this.isLoading = false;
    }
  }

  hasControlError(controlName: string, errorName: string): boolean {
    const control = this.cashForm.get(controlName);
    return !!control && control.hasError(errorName) && (control.touched || control.dirty);
  }

  cancelEdit(): void {
    this.resetForm();
    this.editCancelled.emit();
  }

  private resetForm(): void {
    this.cashForm.reset({
      type: 'income',
      category: 'Servicios',
      concept: '',
      amount: null,
      movementDate: this.todayDateValue(),
      notes: ''
    });
    this.submitError = '';
  }

  private todayDateValue(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
