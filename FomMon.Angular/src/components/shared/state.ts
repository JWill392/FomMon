import {Signal} from '@angular/core';

export enum LocalState {
  pending_add = 'pending_add',
  pending_edit = 'pending_edit',
  pending_delete = 'pending_delete',
  added = 'added',
  deleted = 'deleted',
  error = 'error'
}

export interface LocalStateItem {
  localState: LocalState;
  pendingLocalState?: LocalState;
}

export enum ServiceState {
  idle = 'idle',
  loading = 'loading',
  ready = 'ready',
  error = 'error'
}

export interface ServiceWithState {
  state: Signal<ServiceState>
  error: Signal<Error | null>
}
