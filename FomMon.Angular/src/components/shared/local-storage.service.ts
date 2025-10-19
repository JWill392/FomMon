import {inject, Injectable } from '@angular/core';
import {ErrorService} from "./error.service";

type Serializable = string | number | boolean | null | undefined |
  Map<any, any> | Serializable[] | { [key: string]: Serializable };

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private errorService = inject(ErrorService)

  set(key: string, value: Serializable): void {
    try {
      const jsonValue = value instanceof Map
        ? JSON.stringify(value, this.mapReplacer)
        : JSON.stringify(value);
      localStorage.setItem(key, jsonValue);
    } catch (error) {
      this.errorService.handleError(new Error('Error saving to local storage', error))
    }
  }

  get<T extends Serializable>(key: string): T | null {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value, this.mapReviver) : null;
    } catch (error) {
      this.errorService.handleError(new Error('Error getting from local storage', error))
      return null;
    }
  }

  private mapReplacer<K, V>(key: string, value: Map<K, V>): any {
    if (value instanceof Map) {
      return {
        __type: 'Map',
        value: Array.from(value.entries())
      };
    }
    return value;
  }

  private mapReviver<K, V>(key: string, value: any): Map<K, V> {
    if (typeof value === 'object' && value !== null && value.__type === 'Map') {
      return new Map(value.value);
    }
    return value;
  }
}