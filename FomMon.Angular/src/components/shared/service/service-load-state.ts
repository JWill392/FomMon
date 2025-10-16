import {computed, signal} from '@angular/core';

import {EMPTY, Observable} from 'rxjs';
import {ignoreElements, tap} from 'rxjs/operators';
import {LoadState, ServiceState} from "./service-state";



export class ServiceLoadState implements ServiceState {
  private _value = signal<LoadState>(LoadState.idle);
  value = this._value.asReadonly();

  private _error = signal<Error | null>(null);
  error = this._error.asReadonly();

  isReady = computed(() => this.value() === LoadState.ready);
  isError = computed(() => this.value() === LoadState.error);
  isLoading = computed(() => this.value() === LoadState.loading);
  isIdle = computed(() => this.value() === LoadState.idle);

  loadState = <T>(source: Observable<T>) : Observable<never> => {
    if (!this.isIdle()) {
      return EMPTY; // already initialized or in progress
    }
    this._value.set(LoadState.loading);
    return source
      .pipe(
        tap({
          next: () => this._value.set(LoadState.ready),
          error: (error) => {
            this._error.set(error);
            return this._value.set(LoadState.error)
          }}),
        ignoreElements(),
      );
  }

  // TODO hmm, how to handle reloading with loadstate.  currently it prevents duplicate initializations,
  // but reload should skip that once.  subsequent reloads should be ignored while one is in progress.
  // however, requesting reload should not delete data in service.

  assertReady() {
    if (!this.isReady()) {
      throw new Error('Service not ready');
    }
  }

  asReadonly() : ServiceState {
    return {
      value: this.value,
      error: this.error,
      isReady: this.isReady,
      isError: this.isError,
      isLoading: this.isLoading,
      isIdle: this.isIdle,
    }
  }

  reset() {
    this._value.set(LoadState.idle);
    this._error.set(null);
  }
}
