import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(this.initialPreference());

  constructor() { this.apply(this.dark()); }

  setDark(enabled: boolean): void {
    this.dark.set(enabled);
    this.apply(enabled);
    localStorage.setItem('benchmark-theme', enabled ? 'dark' : 'light');
  }

  private initialPreference(): boolean {
    const saved = localStorage.getItem('benchmark-theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private apply(dark: boolean): void {
    const root = this.document.documentElement;
    root.classList.toggle('app-dark', dark);
    root.dataset['agThemeMode'] = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
  }
}
