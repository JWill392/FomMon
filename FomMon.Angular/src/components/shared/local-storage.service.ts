import {inject, Injectable } from '@angular/core';
import {ErrorService} from "./error.service";

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private errorService = inject(ErrorService)

  set(key: string, value: any): void {
    try {
      const jsonValue = JSON.stringify(value);
      localStorage.setItem(key, jsonValue);
    } catch (error) {
      this.errorService.handleError(new Error('Error saving to local storage', error))
    }
  }

  get<T>(key: string): T | null {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.errorService.handleError(new Error('Error getting from local storage', error))
      return null;
    }
  }
}