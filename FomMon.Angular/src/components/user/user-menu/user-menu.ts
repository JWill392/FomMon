import {Component, ElementRef, inject, OnInit, viewChild} from '@angular/core';
import { UserService } from "../user.service";

@Component({
  selector: 'app-user-menu',
  imports: [],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.css'
})
export class UserMenu implements OnInit {
  private readonly userService = inject(UserService);

  isAuthenticated = this.userService.state.isReady;

  user = this.userService.data;
  profileImageUrl = this.userService.profileImageUrl;

  dialog = viewChild.required<ElementRef<HTMLDialogElement>>('menu')
  private dialogIsOpen = false;

  ngOnInit() {
    // this.dialog().nativeElement.close();
  }

  logout() {
    this.userService.logout();
  }
  login() {
    this.userService.login();
  }
  openMenu(_ : MouseEvent) {
    const dialogElement = this.dialog().nativeElement;

    if (this.dialogIsOpen) return; // prevent re-opening the dialog when clicking the menu button
    dialogElement.show();
    this.dialogIsOpen = true;

    dialogElement.addEventListener('close', () => {
      this.dialogIsOpen = false;
    });
  }

}
