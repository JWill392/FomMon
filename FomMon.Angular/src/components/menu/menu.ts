import { Component, inject, Signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {User} from "../user/user";
import {UserService} from '../user/user.service';
import {RoutePaths} from "../../routes/app.routes";

@Component({
  selector: 'app-menu',
  imports: [RouterModule],
  templateUrl: './menu.html',
  styleUrls: ['./menu.scss']
})
export class MenuComponent {
  userService = inject(UserService)
  isAuthenticated = this.userService.state.isReady;
  user : Signal<User | undefined> = this.userService.data;

  protected readonly RoutePaths = RoutePaths;

  login() {
    this.userService.login();
  }

  logout() {
    this.userService.logout();
  }

}
