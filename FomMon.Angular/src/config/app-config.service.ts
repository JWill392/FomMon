// src/app/config/app-config.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {firstValueFrom, Observable, tap} from 'rxjs';

export interface AppConfig {
  map: {
    defaultCenter: [number, number];
    defaultZoom: [number];
  },
  fom: {
    apiUrl: string;
  },
  app: {
    title: string;
  }
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private http = inject(HttpClient);
  private config: AppConfig | null = null;

  loadConfig(): Promise<AppConfig> {
    return firstValueFrom(this.http.get<AppConfig>('/assets/config.json').pipe(
      tap(config => this.config = config)
    ));
  }

  get(): AppConfig {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    return this.config;
  }
}