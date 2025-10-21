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
}