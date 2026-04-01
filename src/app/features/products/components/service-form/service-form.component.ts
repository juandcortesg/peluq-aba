import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { SalonService } from '../../models/product';

@Component({
  selector: 'app-service-form',
  templateUrl: './service-form.component.html',
  styleUrls: ['./service-form.component.scss']
})
export class ServiceFormComponent implements OnChanges {
  @Input() serviceToEdit: SalonService | null = null;
  @Output() serviceAdded = new EventEmitter<void>();
  @Output() editCancelled = new EventEmitter<void>();

  serviceForm: FormGroup;
  isLoading = false;
  submitError = '';

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {
    this.serviceForm = this.fb.group({
      category: ['Cabello', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]],
      badge: ['Alta demanda', [Validators.maxLength(40)]],
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
      description: ['', [Validators.maxLength(280)]],
      durationMinutes: [45, [Validators.required, Validators.min(10), Validators.max(600)]],
      price: [null, [Validators.required, Validators.min(0)]]
    });
  }

  get controls() {
    return this.serviceForm.controls;
  }

  get descriptionLength(): number {
    return (this.controls['description'].value as string)?.length || 0;
  }

  get previewBadge(): string {
    return this.controls['badge'].value || 'Destacado';
  }

  get formattedDuration(): string {
    return this.formatDuration(this.controls['durationMinutes'].value || 0);
  }

  get isEditing(): boolean {
    return !!this.serviceToEdit;
  }

  get headingLabel(): string {
    return this.isEditing ? 'Editar servicio' : 'Nuevo servicio';
  }

  get headingTitle(): string {
    return this.isEditing ? 'Actualiza servicios de peluqueria' : 'Registra servicios de peluqueria';
  }

  get headingDescription(): string {
    return this.isEditing
      ? 'Modifica categoria, nombre, duracion, precio y descripcion del servicio seleccionado.'
      : 'Crea servicios con categoria, etiqueta, duracion, precio y descripcion para mostrarlos en un apartado propio dentro de la web.';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['serviceToEdit']) {
      return;
    }

    if (!this.serviceToEdit) {
      this.resetForm();
      return;
    }

    this.serviceForm.reset({
      category: this.serviceToEdit.category,
      badge: this.serviceToEdit.badge || '',
      name: this.serviceToEdit.name,
      description: this.serviceToEdit.description || '',
      durationMinutes: Number(this.serviceToEdit.duration_minutes),
      price: Number(this.serviceToEdit.price)
    });
    this.submitError = '';
  }

  async onSubmit(): Promise<void> {
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.submitError = '';

    try {
      const { category, badge, name, description, durationMinutes, price } = this.serviceForm.getRawValue();

      if (this.serviceToEdit) {
        await this.supabaseService.updateService(this.serviceToEdit.id, {
          category,
          badge,
          name,
          description,
          duration_minutes: Number(durationMinutes),
          price: Number(price)
        });
        this.notificationService.success('Servicio actualizado', 'Los cambios del servicio fueron guardados correctamente.');
      } else {
        await this.supabaseService.addService({
          category,
          badge,
          name,
          description,
          duration_minutes: Number(durationMinutes),
          price: Number(price)
        });
        this.notificationService.success('Servicio guardado', 'El servicio fue agregado correctamente.');
      }

      this.resetForm();
      this.serviceAdded.emit();
    } catch (error) {
      console.error(error);
      this.submitError = error instanceof Error
        ? error.message
        : 'Ocurrio un error al guardar el servicio.';
      this.notificationService.error('No se pudo guardar', this.submitError);
    } finally {
      this.isLoading = false;
    }
  }

  hasControlError(controlName: string, errorName: string): boolean {
    const control = this.serviceForm.get(controlName);
    return !!control && control.hasError(errorName) && (control.touched || control.dirty);
  }

  cancelEdit(): void {
    this.resetForm();
    this.editCancelled.emit();
  }

  private resetForm(): void {
    this.serviceForm.reset({
      category: 'Cabello',
      badge: 'Alta demanda',
      name: '',
      description: '',
      durationMinutes: 45,
      price: null
    });
    this.submitError = '';
  }

  private formatDuration(totalMinutes: number): string {
    const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
    }

    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
    }

    return parts.join(' ');
  }
}
