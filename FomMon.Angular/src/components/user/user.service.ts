import {Component, DestroyRef, effect, Inject, inject, Injectable, signal} from '@angular/core';
import { RouterModule } from '@angular/router';
import Keycloak from 'keycloak-js';
import {
  HasRolesDirective,
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
import {ServiceBase} from '../shared/service-base';
import {ServiceState} from '../shared/state';

@Injectable({
  providedIn: 'root'
})
export class UserService extends ServiceBase<User> {
  private readonly authenticated = signal(false);
  isAuthenticated = this.authenticated.asReadonly();

  private keycloakStatus: string | undefined;
  private readonly keycloak = inject(Keycloak);
  private readonly keycloakSignal = inject(KEYCLOAK_EVENT_SIGNAL);
  private readonly http = inject(HttpClient);


  constructor() {
    super();

    effect(() => {
      const keycloakEvent = this.keycloakSignal();

      this.keycloakStatus = keycloakEvent.type;

      if (keycloakEvent.type === KeycloakEventType.Ready) {
        const auth : boolean = typeEventArgs<ReadyArgs>(keycloakEvent.args);

        if (auth) {
          // initial API call to allow api to record keycloak user after registration
          this.initialize$()
            .subscribe({
              complete: () => this.authenticated.set(true),
              error: (error) => {
                console.error('Failed to initialize user service', error);
                this.logout();
              }
            });
        }
        // TODO add role guards spa-user / spa-admin

      }

      if (keycloakEvent.type === KeycloakEventType.AuthLogout) {
        this.clearUser()
        this._state.set(ServiceState.idle);
      }
    });
  }

  protected override load$(destroyRef : DestroyRef) {
    return this.http.get<User>('api/user')
      .pipe(
        catchError((error) => throwError(() => {
          console.error(error);
          this.clearUser()
          this._state.set(ServiceState.error);
          return new Error("Failed to get user")
        })),
        map(u => UserFactory.fromJson(u)),
        tap(u => this._data.set(u)),
        takeUntilDestroyed(destroyRef)
      )
  }

  clearUser() {
    this.authenticated.set(false);
    this._data.set(undefined);
  }

  login() {
    this.keycloak.login();
  }

  logout() {
    this.keycloak.logout();
  }
}
