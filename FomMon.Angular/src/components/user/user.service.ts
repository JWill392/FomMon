import {DestroyRef, effect, inject, Injectable, signal} from '@angular/core';
import Keycloak from 'keycloak-js';
import {
  KEYCLOAK_EVENT_SIGNAL,
  KeycloakEventType,
  typeEventArgs,
  ReadyArgs
} from 'keycloak-angular';
import {UserFactory, User} from "../../types/user";
import {HttpClient} from "@angular/common/http";
import {catchError, map, tap} from "rxjs/operators";
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {throwError} from 'rxjs';
import {ServiceWithState} from "../shared/service/service-state";
import {ServiceLoadState} from "../shared/service/service-load-state";

@Injectable({
  providedIn: 'root'
})
export class UserService implements ServiceWithState {
  private readonly keycloak = inject(Keycloak);
  private readonly keycloakSignal = inject(KEYCLOAK_EVENT_SIGNAL);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<User | undefined>(undefined);
  readonly data = this._data.asReadonly();

  constructor() {
    effect(() => {
      const keycloakEvent = this.keycloakSignal();

      if (keycloakEvent.type === KeycloakEventType.Ready) {
        const auth : boolean = typeEventArgs<ReadyArgs>(keycloakEvent.args);

        if (auth) {
          // initial API call to allow api to record keycloak user after registration
          this.load$()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
        }
      }

      if (keycloakEvent.type === KeycloakEventType.AuthLogout) {
        this._data.set(undefined);
        this._state.reset();
      }
    });
  }

  private load$() {
    return this.http.get<User>('api/user')
      .pipe(
        catchError((error) => throwError(() => {
          this.logout();
          return new Error("Failed to log in", error);
        })),
        map(u => UserFactory.fromJson(u)),
        tap({
          next: u => this._data.set(u),
        }),
        this._state.loadState
      )
  }

  login() {
    this.keycloak.login();
  }

  logout() {
    this.keycloak.logout();
  }
}
