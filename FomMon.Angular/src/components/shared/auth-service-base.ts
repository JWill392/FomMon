import {effect, inject} from '@angular/core';
import {UserService} from '../user/user.service';
import {ServiceState} from './state';
import {ServiceBase} from './service-base';

export abstract class AuthServiceBase<Type> extends ServiceBase<Type> {
  protected userService = inject(UserService);

  public constructor() {
    super();

    effect(() => {
      const auth = this.userService.isAuthenticated();
      if (!auth && this._state() !== ServiceState.idle) {
        this.reset();
      }
    })
  }
}
