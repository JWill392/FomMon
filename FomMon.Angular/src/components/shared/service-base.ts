import {DestroyRef, effect, inject, signal} from '@angular/core';
import {ServiceState, ServiceWithState} from './state';
import {EMPTY, Observable, of} from 'rxjs';
import {ignoreElements, tap} from 'rxjs/operators';


export abstract class ServiceBase<Type> implements ServiceWithState {
  protected _state = signal<ServiceState>(ServiceState.idle);
  state = this._state.asReadonly();

  protected _error = signal<Error | null>(null);
  error = this._error.asReadonly();

  protected _data = signal<Type | undefined>(undefined);
  data = this._data.asReadonly();

  protected destroyRef = inject(DestroyRef);

  public initialize$() {
    if (this._state() !== ServiceState.idle) {
      return EMPTY; // already initialized or in progress
    }
    this._state.set(ServiceState.loading);
    return this.load$(this.destroyRef)
      .pipe(
        tap({
          next: () => this._state.set(ServiceState.ready),
          error: (error) => {
            this._error.set(error);
            return this._state.set(ServiceState.error)
          }}),
        ignoreElements(),
      );
  }

  protected reset() {
    this._state.set(ServiceState.idle);
    this._error.set(null);
    this._data.set(undefined);
  }

  protected abstract load$(destroyRef : DestroyRef) : Observable<Type>;
}
