import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  durationMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly toastsSubject = new BehaviorSubject<NotificationToast[]>([]);

  readonly toasts$ = this.toastsSubject.asObservable();

  show(toast: Omit<NotificationToast, 'id'>): string {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    const nextToast: NotificationToast = {
      id,
      ...toast,
      durationMs: toast.durationMs ?? 3600
    };

    this.toastsSubject.next([...this.toastsSubject.value, nextToast]);

    window.setTimeout(() => this.dismiss(id), nextToast.durationMs);

    return id;
  }

  success(title: string, message: string, durationMs = 3200): string {
    return this.show({ type: 'success', title, message, durationMs });
  }

  error(title: string, message: string, durationMs = 4200): string {
    return this.show({ type: 'error', title, message, durationMs });
  }

  info(title: string, message: string, durationMs = 2600): string {
    return this.show({ type: 'info', title, message, durationMs });
  }

  warning(title: string, message: string, durationMs = 3800): string {
    return this.show({ type: 'warning', title, message, durationMs });
  }

  dismiss(id: string): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((toast) => toast.id !== id));
  }
}
