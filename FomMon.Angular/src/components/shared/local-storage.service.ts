import {inject, Injectable } from '@angular/core';
import {ErrorService} from "./error.service";

type Serializable = string | number | boolean | null | undefined |
  Map<any, any> | Serializable[] | { [key: string]: Serializable };

interface StorageWrapper<T extends Serializable> {
  version: number;
  data: T;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private errorService = inject(ErrorService)
  private static readonly baseKey = 'fommon.';

  set<T extends Serializable>(key: string, value: T, version: number): void {
    try {
      const wrapper: StorageWrapper<T> = {
        version: version,
        data: value,
        timestamp: Date.now(),
      };

      const jsonValue = value instanceof Map
        ? JSON.stringify(wrapper, this.mapReplacer)
        : JSON.stringify(wrapper);

      localStorage.setItem(LocalStorageService.baseKey + key, jsonValue);

    } catch (error) {
      this.errorService.handleError(new Error('Error saving to local storage', {cause: error}))
    }
  }

  get<T extends Serializable>(key: string, expectedVersion: number): T | null {
    try {
      const value = localStorage.getItem(LocalStorageService.baseKey + key);
      if (!value) return null;

      const wrapper: StorageWrapper<T> = JSON.parse(value, this.reviver.bind(this));

      if (wrapper?.version !== expectedVersion) {
        this.errorService.warn(`Version mismatch for ${key}: expected ${expectedVersion}, got ${wrapper?.version}`);
        this.remove(key)
      }

      return wrapper.data;

    } catch (error) {
      this.errorService.handleError(new Error('Error getting from local storage', {cause: error}))
      return null;
    }
  }


  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this.errorService.handleError(new Error('Error removing from local storage', {cause: error}))
    }
  }

  private mapReplacer<K, V>(_: string, value: Map<K, V>): any {
    if (value instanceof Map) {
      return {
        __type: 'Map',
        value: Array.from(value.entries())
      };
    }
    return value;
  }

  private reviver(key: string, value: any): Serializable {
    if (typeof value === 'object' && value !== null && value.__type === 'Map') {
      return this.mapReviver(value);
    }
    return value;
  }
  private mapReviver<K, V>(value: any): Map<K, V> {
    return new Map(value.value);
  }
}