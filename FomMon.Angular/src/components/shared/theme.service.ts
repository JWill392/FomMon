import {computed, DOCUMENT, effect, inject, Injectable, Renderer2, signal} from "@angular/core";
import {LocalStorageService} from "./local-storage.service";

export type Theme = 'light' | 'dark'

@Injectable({
  providedIn: "root"
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private localStorageService = inject(LocalStorageService);

  private readonly localStore_setDarkMode = {key: 'theme.isDarkMode' as const, version: 1};

  private darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  private prefersDarkMode = signal(this.darkModeQuery.matches);
  private hasSetDarkMode = signal<boolean | undefined>(undefined);


  theme = computed<Theme>(() => {
    const isDark = this.hasSetDarkMode() ?? this.prefersDarkMode();
    return isDark ? 'dark' : 'light';
  });
  isDarkMode = computed(() => this.theme() === 'dark')

  constructor() {
    this.darkModeQuery.addEventListener('change', (e) => this.prefersDarkMode.set(e.matches));

    this.hasSetDarkMode.set(this.localStorageService.get(this.localStore_setDarkMode));

    effect(() => {
      const hasSetDarkTheme = this.hasSetDarkMode();
      this.localStorageService.set(this.localStore_setDarkMode, hasSetDarkTheme);
    })

    effect(() => {
      const theme = this.theme();
      const htmlElement = this.document.documentElement;

      switch (theme) {
        case 'light':
          this.document.body.classList.remove('dark-mode');
          htmlElement.style.colorScheme = 'light';
          break;
        case 'dark':
          this.document.body.classList.add('dark-mode');
          htmlElement.style.colorScheme = 'dark';
          break
      }
    })
  }

  get allThemes() {
    return ['light', 'dark'] as const;
  }

  setDarkMode(isDark: boolean | undefined) {
    this.hasSetDarkMode.set(isDark);
  }
}