import {inject, Injectable } from '@angular/core';
import {ErrorService} from "./error.service";

type Serializable = string | number | boolean | null | undefined |
  Map<any, any> | Serializable[] | { [key: string]: Serializable };

export type LocalKey = {key: string, version: number}
export type LocalKeyNoVersion = Omit<LocalKey, 'version'>

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

  set<T extends Serializable>(localKey: LocalKey, value: T): boolean {
    this._validateLocalKey(localKey);

    const wrapper: StorageWrapper<T> = {
      version: localKey.version,
      data: value,
      timestamp: Date.now(),
    };

    const jsonValue = value instanceof Map
      ? JSON.stringify(wrapper, this.mapReplacer)
      : JSON.stringify(wrapper);

    return this._setItem(localKey.key, jsonValue);
  }

  get<T extends Serializable>(localKey: LocalKey): T | null {
    this._validateLocalKey(localKey);

    const value = this._getItem(localKey.key);
    if (!value) return null;

    let wrapper: StorageWrapper<T>;
    try {
      wrapper = JSON.parse(value, this.reviver.bind(this));
    } catch (error) {
      this.errorService.warn(`Error parsing local storage value for ${localKey.key}`, error);
      return null;
    }

    if (wrapper?.version !== localKey.version) {
      this.errorService.warn(`Version mismatch for ${localKey.key}: expected ${localKey.version}, got ${wrapper?.version}.`);
      return null;
    }

    return wrapper.data;
  }

  remove(localKey: LocalKeyNoVersion): boolean {
    return this._removeItem(localKey.key);
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




  private asFullKey(key: string) {
    return LocalStorageService.baseKey + key;
  }
  private _getItem(key: string) {
    return localStorage.getItem(this.asFullKey(key));
  }
  private _setItem(key: string, value: string) : boolean {
    try {
      localStorage.setItem(this.asFullKey(key), value);
      return true;
    } catch (error) {
      this.errorService.handleError(new Error('Error adding item to local storage', {cause: error}))
      return false;
    }
  }
  private _removeItem(key: string) : boolean {
    try {
      localStorage.removeItem(this.asFullKey(key));
      return true;
    } catch (error) {
      this.errorService.handleError(new Error('Error removing from local storage', {cause: error}))
      return false;
    }
  }


  private _validateLocalKey(localKey: LocalKey) {
    if (!localKey) throw new Error('localKey is required');
    if (!localKey.key) throw new Error('localKey must have key property');
    if (!localKey.version || typeof localKey.version !== "number") throw new Error('localKey must have numeric version property');
  }
}