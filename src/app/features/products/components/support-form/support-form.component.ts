import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import {
  CreateSupportTicketPayload,
  SupportAssistantContext,
  SupportAssistantReply,
  SupportModuleArea,
  SupportTicket
} from '../../models/support';

@Component({
  selector: 'app-support-form',
  templateUrl: './support-form.component.html',
  styleUrls: ['./support-form.component.scss']
})
export class SupportFormComponent implements OnChanges {
  @Input() supportContext: SupportAssistantContext = {
    productCount: 0,
    serviceCount: 0,
    cashMovementCount: 0,
    inventoryItemCount: 0,
    lowStockCount: 0,
    openTicketCount: 0
  };
  @Input() ticketToEdit: SupportTicket | null = null;

  @Output() ticketCreated = new EventEmitter<void>();
  @Output() editCancelled = new EventEmitter<void>();

  assistantForm: FormGroup;
  ticketForm: FormGroup;

  assistantReply: SupportAssistantReply = this.buildWelcomeReply();
  isCreatingTicket = false;
  ticketSubmitError = '';

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {
    this.assistantForm = this.fb.group({
      question: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(280)]]
    });

    this.ticketForm = this.fb.group({
      module: ['general', [Validators.required]],
      priority: ['medium', [Validators.required]],
      title: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(90)]],
      description: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(480)]]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['supportContext'] && !this.assistantForm.dirty) {
      this.assistantReply = this.buildWelcomeReply();
    }

    if (changes['ticketToEdit']) {
      this.applyTicketEditingState();
    }
  }

  get assistantControls() {
    return this.assistantForm.controls;
  }

  get ticketControls() {
    return this.ticketForm.controls;
  }

  get descriptionLength(): number {
    return (this.ticketControls['description'].value as string)?.length || 0;
  }

  get currentModuleLabel(): string {
    return this.getModuleLabel(this.ticketControls['module'].value as SupportModuleArea);
  }

  get isEditingTicket(): boolean {
    return !!this.ticketToEdit;
  }

  askAssistant(): void {
    if (this.assistantForm.invalid) {
      this.assistantForm.markAllAsTouched();
      return;
    }

    const question = `${this.assistantControls['question'].value || ''}`.trim();
    this.assistantReply = this.buildAssistantReply(question);
  }

  async onSubmitTicket(): Promise<void> {
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.isCreatingTicket = true;
    this.ticketSubmitError = '';

    try {
      const payload = this.ticketForm.getRawValue() as CreateSupportTicketPayload;

      if (this.ticketToEdit) {
        await this.supabaseService.updateSupportTicket(this.ticketToEdit.id, {
          module: payload.module,
          priority: payload.priority,
          title: payload.title,
          description: payload.description,
          status: this.ticketToEdit.status,
          resolution_note: this.ticketToEdit.resolution_note
        });
        this.notificationService.success('Caso actualizado', 'El ticket de soporte fue actualizado correctamente.');
      } else {
        await this.supabaseService.addSupportTicket({
          module: payload.module,
          priority: payload.priority,
          title: payload.title,
          description: payload.description
        });
        this.notificationService.success('Caso registrado', 'El ticket de soporte fue creado con trazabilidad.');
      }

      this.resetTicketForm();
      this.ticketCreated.emit();
    } catch (error) {
      console.error(error);
      this.ticketSubmitError = error instanceof Error
        ? error.message
        : 'Ocurrio un error al registrar el caso de soporte.';
      this.notificationService.error('No se pudo registrar', this.ticketSubmitError);
    } finally {
      this.isCreatingTicket = false;
    }
  }

  hasAssistantControlError(controlName: string, errorName: string): boolean {
    const control = this.assistantForm.get(controlName);
    return !!control && control.hasError(errorName) && (control.touched || control.dirty);
  }

  hasTicketControlError(controlName: string, errorName: string): boolean {
    const control = this.ticketForm.get(controlName);
    return !!control && control.hasError(errorName) && (control.touched || control.dirty);
  }

  cancelTicketEdit(): void {
    this.resetTicketForm();
    this.editCancelled.emit();
  }

  private buildWelcomeReply(): SupportAssistantReply {
    const { productCount, serviceCount, cashMovementCount, inventoryItemCount, lowStockCount, openTicketCount } = this.supportContext;

    return {
      title: 'Asistente listo para ayudarte',
      relatedModule: 'support',
      answer: `Ahora mismo el sistema registra ${productCount} productos, ${serviceCount} servicios, ${cashMovementCount} movimientos de caja, ${inventoryItemCount} items de inventario y ${openTicketCount} casos abiertos.`,
      suggestions: [
        lowStockCount > 0
          ? `Tienes ${lowStockCount} alertas de stock activas.`
          : 'No hay alertas de inventario en este momento.',
        'Puedes preguntarme por productos, servicios, caja, inventario o soporte.',
        'Si el problema necesita seguimiento, crea un ticket desde este mismo modulo.'
      ]
    };
  }

  private buildAssistantReply(question: string): SupportAssistantReply {
    const normalizedQuestion = this.normalizeText(question);

    if (this.containsAny(normalizedQuestion, ['producto', 'catalogo', 'imagen', 'precio'])) {
      return {
        title: 'Ayuda para productos',
        relatedModule: 'products',
        answer: this.supportContext.productCount > 0
          ? `El catalogo ya tiene ${this.supportContext.productCount} productos. Si necesitas cargar otro, usa el formulario de Productos con nombre y precio obligatorios; la imagen y la descripcion son opcionales.`
          : 'Todavia no hay productos registrados. Ve al apartado Productos, completa nombre y precio, y luego guarda para crear el primer item del catalogo.',
        suggestions: [
          'Verifica que Supabase tenga permisos de lectura e insercion para la tabla products.',
          'Si no subes foto, el sistema usara la imagen suplementaria.',
          'Si ves un error al guardar, registra un ticket indicando el mensaje exacto.'
        ]
      };
    }

    if (this.containsAny(normalizedQuestion, ['servicio', 'duracion', 'corte', 'cepillado'])) {
      return {
        title: 'Ayuda para servicios',
        relatedModule: 'services',
        answer: this.supportContext.serviceCount > 0
          ? `Actualmente hay ${this.supportContext.serviceCount} servicios registrados. Puedes crear otro definiendo categoria, nombre, duracion y precio.`
          : 'Aun no hay servicios registrados. Entra al apartado Servicios y completa categoria, nombre, duracion en minutos y precio.',
        suggestions: [
          'La duracion se guarda en minutos y el sistema la traduce a horas y minutos.',
          'Si quieres resaltar un servicio, usa el badge.',
          'Comprueba que la tabla services tenga policies de select, insert y delete.'
        ]
      };
    }

    if (this.containsAny(normalizedQuestion, ['caja', 'finanza', 'ingreso', 'egreso', 'cierre'])) {
      return {
        title: 'Ayuda para caja',
        relatedModule: 'cash',
        answer: this.supportContext.cashMovementCount > 0
          ? `Ya tienes ${this.supportContext.cashMovementCount} movimientos de caja. Puedes filtrarlos por hoy, mes actual o rango personalizado, y generar cierre o exportacion CSV.`
          : 'Todavia no hay movimientos de caja. Registra un ingreso o egreso desde el formulario de Caja para activar los reportes y el cierre.',
        suggestions: [
          'Usa categorias claras para distinguir ventas, compras y gastos operativos.',
          'Si el balance sale negativo, revisa primero los egresos recientes.',
          'El cierre automatico resume el periodo activo que tengas seleccionado.'
        ]
      };
    }

    if (this.containsAny(normalizedQuestion, ['inventario', 'stock', 'insumo', 'entrada', 'salida', 'reposicion'])) {
      return {
        title: 'Ayuda para inventario',
        relatedModule: 'inventory',
        answer: this.supportContext.inventoryItemCount > 0
          ? `El sistema ya controla ${this.supportContext.inventoryItemCount} items de inventario${this.supportContext.lowStockCount ? ` y detecta ${this.supportContext.lowStockCount} alertas de stock.` : '.'}`
          : 'Todavia no hay items en inventario. Primero crea un producto o insumo, luego registra entradas o salidas para activar la trazabilidad.',
        suggestions: [
          'Configura bien el stock minimo para recibir alertas reales.',
          'Cada salida descuenta stock automaticamente cuando el movimiento se guarda.',
          'Si una salida falla, revisa si el item tiene stock suficiente.'
        ]
      };
    }

    if (this.containsAny(normalizedQuestion, ['tema', 'oscuro', 'claro', 'pantalla'])) {
      return {
        title: 'Ayuda de interfaz',
        relatedModule: 'general',
        answer: 'Puedes cambiar el tema desde el boton principal del encabezado. El sistema conserva el modo claro u oscuro en la sesion.',
        suggestions: [
          'Si algo se ve desordenado, indica en un ticket la seccion exacta y una captura si es posible.',
          'En celular los paneles se apilan automaticamente.',
          'Actualiza la pagina si quieres confirmar que el tema quedo persistido.'
        ]
      };
    }

    if (this.containsAny(normalizedQuestion, ['supabase', 'error', 'guardar', 'conexion', 'cargar'])) {
      return {
        title: 'Ayuda de conexion y errores',
        relatedModule: 'general',
        answer: 'Cuando una operacion no guarda o no carga, normalmente debes revisar las policies de Supabase, el schema ejecutado y las credenciales del environment.',
        suggestions: [
          'Confirma que la tabla del modulo exista en Supabase.',
          'Revisa si RLS tiene policies de select, insert, update o delete segun el caso.',
          'Si el error persiste, crea un ticket con el mensaje exacto y el modulo donde ocurre.'
        ]
      };
    }

    return {
      title: 'Ayuda general',
      relatedModule: 'general',
      answer: 'Puedo orientarte sobre productos, servicios, caja, inventario, tema visual o errores de conexion. Si el problema necesita seguimiento, crea un ticket de soporte para dejarlo trazado.',
      suggestions: [
        'Haz preguntas concretas como: "como registro una salida de inventario".',
        'Indica el modulo donde ocurre el problema para darte una guia mas precisa.',
        'Si ya intentaste algo, cuentame el mensaje de error o el comportamiento exacto.'
      ]
    };
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private containsAny(source: string, fragments: string[]): boolean {
    return fragments.some((fragment) => source.includes(fragment));
  }

  private applyTicketEditingState(): void {
    if (!this.ticketToEdit) {
      this.resetTicketForm();
      return;
    }

    this.ticketForm.reset({
      module: this.ticketToEdit.module,
      priority: this.ticketToEdit.priority,
      title: this.ticketToEdit.title,
      description: this.ticketToEdit.description
    });
    this.ticketSubmitError = '';
  }

  private resetTicketForm(): void {
    this.ticketForm.reset({
      module: 'general',
      priority: 'medium',
      title: '',
      description: ''
    });
    this.ticketSubmitError = '';
  }

  private getModuleLabel(module: SupportModuleArea): string {
    const labels: Record<SupportModuleArea, string> = {
      general: 'General',
      products: 'Productos',
      services: 'Servicios',
      cash: 'Caja',
      inventory: 'Inventario',
      support: 'Soporte'
    };

    return labels[module];
  }
}
