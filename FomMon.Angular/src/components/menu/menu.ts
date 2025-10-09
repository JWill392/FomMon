import { Component, effect, inject, Signal } from '@angular/core';
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
import {map} from "rxjs/operators";
import {UserService} from '../user/user.service';

@Component({
  selector: 'app-menu',
  imports: [RouterModule, HasRolesDirective],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class MenuComponent {
  userService = inject(UserService)
  isAuthenticated = this.userService.isAuthenticated;
  user : Signal<User | undefined> = this.userService.data;


  login() {
    this.userService.login();
  }

  logout() {
    this.userService.logout();
  }
}
