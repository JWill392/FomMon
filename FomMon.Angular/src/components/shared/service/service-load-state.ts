import {computed, signal} from '@angular/core';

import {EMPTY, Observable} from 'rxjs';
import {ignoreElements, tap} from 'rxjs/operators';
import {LoadState, ServiceState} from "./service-state";


export class ServiceLoadState implements ServiceState {
  private _dependencies: ServiceState[];

  private _value = signal<LoadState>(LoadState.idle);
  value = computed<LoadState>(() => ServiceLoadState.maxState([...this._dependencies.map(s=>s.value()), this._value()])!);

  private _error = signal<Error | null>(null);
  error = this._error.asReadonly();

  isReady = computed(() => this.value() === LoadState.ready);
  isError = computed(() => this.value() === LoadState.error);
  isLoading = computed(() => this.value() === LoadState.loading);
  isIdle = computed(() => this.value() === LoadState.idle);


  constructor(dependencies?: ServiceState[]) {
    this._dependencies = [...dependencies ?? []];
  }

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


  private static maxState(states: LoadState[]) : LoadState | undefined {
    if (states.length === 0) {
      return undefined;
    }
    return states.reduce((a, b) => ServiceLoadState.compareState(a, b) > 0 ? a : b);
  }
  private static compareState(a: LoadState, b: LoadState) : number {
    return ServiceLoadState.getStateCompareValue(a) - ServiceLoadState.getStateCompareValue(b);
  }
  private static getStateCompareValue(s: LoadState) : number {
    switch (s) {
      case LoadState.ready: return 1;
      case LoadState.loading: return 2;
      case LoadState.idle: return 3;
      case LoadState.error: return 4;
      default: throw new Error('Invalid load state');
    }
  }

  reset() {
    this._value.set(LoadState.idle);
    this._error.set(null);
  }
}
