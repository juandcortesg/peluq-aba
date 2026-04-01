import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'peluq-aba-theme';
  private currentTheme: ThemeMode = 'light';

  constructor(@Inject(DOCUMENT) private document: Document) {
    this.initializeTheme();
  }

  get theme(): ThemeMode {
    return this.currentTheme;
  }

  get isDarkTheme(): boolean {
    return this.currentTheme === 'dark';
  }

  toggleTheme(): ThemeMode {
    const nextTheme: ThemeMode = this.isDarkTheme ? 'light' : 'dark';
    this.setTheme(nextTheme);
    return nextTheme;
  }

  private initializeTheme(): void {
    const storedTheme = this.readStoredTheme();
    const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    this.setTheme(storedTheme ?? preferredTheme, false);
  }

  private setTheme(theme: ThemeMode, persist = true): void {
    this.currentTheme = theme;
    this.document.documentElement.setAttribute('data-theme', theme);

    if (persist) {
      window.localStorage.setItem(this.storageKey, theme);
    }
  }

  private readStoredTheme(): ThemeMode | null {
    const storedTheme = window.localStorage.getItem(this.storageKey);
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
  }
}
