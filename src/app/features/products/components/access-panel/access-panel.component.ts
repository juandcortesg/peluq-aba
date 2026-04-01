import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-access-panel',
  templateUrl: './access-panel.component.html',
  styleUrls: ['./access-panel.component.scss']
})
export class AccessPanelComponent {
  @Input() isAuthReady = false;
  @Input() isAdmin = false;
  @Input() currentUserEmail: string | null = null;
  @Input() adminEmail = '';
  @Input() isSendingAccessLink = false;

  @Output() requestAdminAccess = new EventEmitter<void>();
  @Output() signOutRequested = new EventEmitter<void>();

  get maskedAdminEmail(): string {
    return this.maskEmail(this.adminEmail);
  }

  get maskedCurrentUserEmail(): string {
    return this.maskEmail(this.currentUserEmail);
  }

  get eyebrowLabel(): string {
    if (!this.isAuthReady) {
      return 'Acceso';
    }

    if (this.isAdmin) {
      return 'Administrador';
    }

    if (this.currentUserEmail) {
      return 'Sesion limitada';
    }

    return 'Usuario';
  }

  get title(): string {
    if (!this.isAuthReady) {
      return 'Verificando acceso';
    }

    if (this.isAdmin) {
      return 'Control total habilitado';
    }

    if (this.currentUserEmail) {
      return 'Sesion sin permisos de administrador';
    }

    return 'Modo consulta activo';
  }

  get description(): string {
    if (!this.isAuthReady) {
      return 'Estamos revisando si existe una sesion activa del administrador.';
    }

    if (this.isAdmin) {
      return `Entraste como ${this.maskedCurrentUserEmail}. Tienes acceso a productos, servicios, caja, inventario y soporte.`;
    }

    if (this.currentUserEmail) {
      return `La cuenta ${this.maskedCurrentUserEmail} solo conserva vista publica. El correo administrador autorizado es ${this.maskedAdminEmail}.`;
    }

    return `Los usuarios normales solo consultan productos y servicios. Por pruebas, puedes activar el modo administrador con el boton y el correo autorizado es ${this.maskedAdminEmail}.`;
  }

  requestAccess(): void {
    this.requestAdminAccess.emit();
  }

  signOut(): void {
    this.signOutRequested.emit();
  }

  private maskEmail(email: string | null | undefined): string {
    if (!email || !email.includes('@')) {
      return '';
    }

    const [localPart, domain] = email.split('@');

    if (!localPart) {
      return email;
    }

    if (localPart.length <= 5) {
      const visibleStart = localPart.slice(0, 2);
      const visibleEnd = localPart.slice(-1);
      return `${visibleStart}***${visibleEnd}@${domain}`;
    }

    const visibleStart = localPart.slice(0, 3);
    const visibleEnd = localPart.slice(-3);

    return `${visibleStart}******${visibleEnd}@${domain}`;
  }
}
