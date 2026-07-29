import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

export interface ThemeColors {
  surface: string;
  plot: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(this.initialPreference());
  readonly colors = computed<ThemeColors>(() =>
    this.dark()
      ? {
          surface: '#0d1938',
          plot: '#07112d',
          text: '#ffffff',
          muted: '#c9cee0',
          line: '#334061',
          accent: '#8aaed8',
        }
      : {
          surface: '#ffffff',
          plot: '#f7f8fb',
          text: '#000e52',
          muted: '#4f4f4f',
          line: '#e5e5e6',
          accent: '#046cb4',
        },
  );

  constructor() {
    this.apply(this.dark());
  }

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
