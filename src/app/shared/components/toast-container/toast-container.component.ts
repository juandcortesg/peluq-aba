import { Component } from '@angular/core';
import { NotificationService, NotificationToast } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss']
})
export class ToastContainerComponent {
  readonly toasts$ = this.notificationService.toasts$;

  constructor(private notificationService: NotificationService) {}

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  trackByToast(_index: number, toast: NotificationToast): string {
    return toast.id;
  }
}
