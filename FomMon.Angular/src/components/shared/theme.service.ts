import {computed, DOCUMENT, effect, inject, Injectable, signal} from "@angular/core";
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

  private browserPrefersDarkMode = signal(this.darkModeQuery.matches);
  private overrideDarkMode = signal<boolean | undefined>(undefined);


  theme = computed<Theme>(() => {
    const isDark = this.overrideDarkMode() ?? this.browserPrefersDarkMode();
    return isDark ? 'dark' : 'light';
  });
  isDarkMode = computed(() => this.theme() === 'dark')

  constructor() {
    this.darkModeQuery.addEventListener('change', (e) => this.browserPrefersDarkMode.set(e.matches));

    this.overrideDarkMode.set(this.localStorageService.get<boolean>(this.localStore_setDarkMode));


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

  setDarkMode(isDark: boolean | undefined) {
    this.overrideDarkMode.set(isDark);
    if (isDark === undefined) {
      this.localStorageService.remove(this.localStore_setDarkMode);
    } else {
      this.localStorageService.set(this.localStore_setDarkMode, isDark);
    }
  }
}