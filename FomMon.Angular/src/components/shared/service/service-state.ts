import {Signal} from '@angular/core';


export interface ServiceWithState {
  readonly state: ServiceState
}

export interface ServiceState {
  value: Signal<LoadState>
  error: Signal<Error | null>

  isIdle: Signal<Boolean>
  isLoading: Signal<Boolean>
  isReady: Signal<Boolean>
  isError: Signal<Boolean>
}
export enum LoadState {
  idle = 'idle',
  loading = 'loading',
  ready = 'ready',
  error = 'error'
}