import { Component, inject, Signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {User} from "../../types/user";
import {UserService} from '../user/user.service';

@Component({
  selector: 'app-menu',
  imports: [RouterModule],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class MenuComponent {
  userService = inject(UserService)
  isAuthenticated = this.userService.state.isReady;
  user : Signal<User | undefined> = this.userService.data;


  login() {
    this.userService.login();
  }

  logout() {
    this.userService.logout();
  }
}
