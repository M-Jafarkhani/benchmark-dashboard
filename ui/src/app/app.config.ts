import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

const Nfdi4Ing = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e8f4fb',
      100: '#c6e3f4',
      200: '#91c8e8',
      300: '#5caddc',
      400: '#2491cf',
      500: '#046cb4',
      600: '#035f9f',
      700: '#025087',
      800: '#02416e',
      900: '#013257',
      950: '#001d33',
    },
    colorScheme: {
      light: {
        primary: {
          color: '#046cb4',
          contrastColor: '#ffffff',
          hoverColor: '#0da5de',
          activeColor: '#035f9f',
        },
      },
      dark: {
        primary: {
          color: '#8aaed8',
          contrastColor: '#000e52',
          hoverColor: '#0da5de',
          activeColor: '#b6cce6',
        },
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: { preset: Nfdi4Ing, options: { darkModeSelector: '.app-dark' } },
    }),
  ],
};
