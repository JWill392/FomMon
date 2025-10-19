import {DestroyRef, effect, inject, Injectable, signal} from '@angular/core';
import Keycloak from 'keycloak-js';
import {
  KEYCLOAK_EVENT_SIGNAL,
  KeycloakEventType,
  typeEventArgs,
  ReadyArgs
} from 'keycloak-angular';
import {UserFactory, User} from "./user";
import {HttpClient} from "@angular/common/http";
import {catchError, map, tap} from "rxjs/operators";
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {throwError} from 'rxjs';
import {ServiceWithState} from "../shared/service/service-state";
import {ServiceLoadState} from "../shared/service/service-load-state";
import {ErrorService} from "../shared/error.service";

@Injectable({
  providedIn: 'root'
})
export class UserService implements ServiceWithState {
  private readonly keycloak = inject(Keycloak);
  private readonly keycloakSignal = inject(KEYCLOAK_EVENT_SIGNAL);

  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorService = inject(ErrorService);

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<User | undefined>(undefined);
  readonly data = this._data.asReadonly();

  private _profileImageUrl = signal<string | undefined>(undefined);
  readonly profileImageUrl = this._profileImageUrl.asReadonly();

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

          this.loadImageUrl$()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
        }
      }

      if (keycloakEvent.type === KeycloakEventType.AuthLogout) {
        this.clearData();
      }
    });
  }

  private clearData() {
    this._data.set(undefined);
    this._profileImageUrl.set(undefined);
    this._state.reset();
  }

  private load$() {
    return this.http.get<User>('api/user')
      .pipe(
        catchError((error) => throwError(() => {
          this.logout();
          const e = new Error("Failed to log in", {cause: error});

          this.errorService.handleError(e);
          return e;
        })),
        map(u => UserFactory.fromJson(u)),
        tap({
          next: u => this._data.set(u),
        }),
        this._state.loadState
      )
  }

  private loadImageUrl$() {
    return this.http.get<{url: string}>('api/user/profileimage')
      .pipe(
        catchError(error => throwError(() => {
          const e = new Error("Failed to load profile image", {cause: error});
          this.errorService.handleError(e); // TODO warning not error
          return e;
        })),
        map(body => body?.url ?? undefined),
        tap({
          next: u => this._profileImageUrl.set(u),
        })
        // not reflected in service state; non-critical
      )
  }

  login() {
    this.keycloak.login();
  }

  logout() {
    this.keycloak.logout();
  }
}
