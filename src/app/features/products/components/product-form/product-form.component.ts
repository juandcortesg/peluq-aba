import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { DEFAULT_PRODUCT_IMAGE, SupabaseService } from '../../../../core/services/supabase.service';
import { Product } from '../../models/product';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent implements OnChanges, OnDestroy {
  @Input() productToEdit: Product | null = null;
  @Output() productAdded = new EventEmitter<void>();
  @Output() editCancelled = new EventEmitter<void>();

  productForm: FormGroup;
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  removeCurrentImage = false;
  isLoading = false;
  submitError = '';
  imageError = '';
  readonly defaultImageUrl = DEFAULT_PRODUCT_IMAGE;
  readonly maxFileSizeInBytes = 2 * 1024 * 1024;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
      price: [null, [Validators.required, Validators.min(0)]],
      description: ['', [Validators.maxLength(280)]]
    });
  }

  get controls() {
    return this.productForm.controls;
  }

  get previewImage(): string {
    return this.imagePreview || this.defaultImageUrl;
  }

  get descriptionLength(): number {
    return (this.controls['description'].value as string)?.length || 0;
  }

  get isEditing(): boolean {
    return !!this.productToEdit;
  }

  get headingLabel(): string {
    return this.isEditing ? 'Editar producto' : 'Registro profesional';
  }

  get headingTitle(): string {
    return this.isEditing ? 'Actualiza un producto del catalogo' : 'Agrega productos a peluq-ABA';
  }

  get headingDescription(): string {
    return this.isEditing
      ? 'Modifica nombre, precio, descripcion o imagen del producto seleccionado sin perder la estructura del catalogo.'
      : 'Nombre y precio son obligatorios. La descripcion y la imagen son opcionales; si no subes foto, se mostrara una imagen suplementaria elegante por defecto.';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['productToEdit']) {
      return;
    }

    this.applyEditingState();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    this.imageError = '';

    if (!file) {
      this.clearSelectedImage();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.imageError = 'Selecciona un archivo de imagen valido.';
      input.value = '';
      return;
    }

    if (file.size > this.maxFileSizeInBytes) {
      this.imageError = 'La imagen debe pesar 2 MB o menos.';
      input.value = '';
      return;
    }

    this.clearPreviewUrl();
    this.selectedFile = file;
    this.imagePreview = URL.createObjectURL(file);
  }

  async onSubmit(): Promise<void> {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.submitError = '';

    try {
      const { name, price, description } = this.productForm.getRawValue();

      if (this.productToEdit) {
        await this.supabaseService.updateProduct(
          this.productToEdit,
          {
            name,
            price: Number(price),
            description
          },
          this.selectedFile,
          this.removeCurrentImage
        );

        this.notificationService.success('Producto actualizado', 'Los cambios del producto fueron guardados correctamente.');
      } else {
        await this.supabaseService.addProduct(
          {
            name,
            price: Number(price),
            description
          },
          this.selectedFile
        );

        this.notificationService.success('Producto guardado', 'El producto fue agregado correctamente al catalogo.');
      }

      this.resetFormState();
      this.productAdded.emit();
    } catch (error) {
      console.error(error);
      this.submitError = error instanceof Error
        ? error.message
        : 'Ocurrio un error al guardar el producto.';
      this.notificationService.error('No se pudo guardar', this.submitError);
    } finally {
      this.isLoading = false;
    }
  }

  removeSelectedImage(input: HTMLInputElement): void {
    input.value = '';
    this.clearSelectedImage(true);
  }

  cancelEdit(): void {
    this.resetFormState();
    this.editCancelled.emit();
  }

  hasControlError(controlName: string, errorName: string): boolean {
    const control = this.productForm.get(controlName);
    return !!control && control.hasError(errorName) && (control.touched || control.dirty);
  }

  ngOnDestroy(): void {
    this.clearPreviewUrl();
  }

  private applyEditingState(): void {
    if (!this.productToEdit) {
      this.resetFormState(false);
      return;
    }

    this.productForm.reset({
      name: this.productToEdit.name,
      price: Number(this.productToEdit.price),
      description: this.productToEdit.description || ''
    });

    this.selectedFile = null;
    this.removeCurrentImage = false;
    this.clearPreviewUrl();
    this.imagePreview = this.productToEdit.image_url || this.defaultImageUrl;
    this.submitError = '';
    this.imageError = '';
  }

  private resetFormState(emitCancel = false): void {
    this.productForm.reset({
      name: '',
      price: null,
      description: ''
    });
    this.clearSelectedImage();
    this.removeCurrentImage = false;
    this.submitError = '';
    this.imageError = '';

    if (emitCancel) {
      this.editCancelled.emit();
    }
  }

  private clearSelectedImage(markImageRemoval = false): void {
    this.selectedFile = null;
    this.removeCurrentImage = markImageRemoval && this.isEditing;
    this.clearPreviewUrl();

    if (this.isEditing) {
      this.imagePreview = this.removeCurrentImage
        ? this.defaultImageUrl
        : this.productToEdit?.image_url || this.defaultImageUrl;
    }
  }

  private clearPreviewUrl(): void {
    if (this.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreview);
    }

    this.imagePreview = null;
  }
}
