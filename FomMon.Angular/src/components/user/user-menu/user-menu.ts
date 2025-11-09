import {Component, ElementRef, inject, OnInit, viewChild} from '@angular/core';
import { UserService } from "../user.service";
import {MatSlideToggle} from "@angular/material/slide-toggle";
import {ThemeService} from "../../shared/theme.service";
import {MatActionList, MatListItem} from "@angular/material/list";
import {MatButton} from "@angular/material/button";

@Component({
  selector: 'app-user-menu',
  imports: [
    MatSlideToggle,
    MatListItem,
    MatActionList,
    MatButton
  ],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss'
})
export class UserMenu {
  private readonly userService = inject(UserService);
  private readonly themeService = inject(ThemeService);

  isDarkMode = this.themeService.isDarkMode;
  isAuthenticated = this.userService.state.isReady;

  user = this.userService.data;
  profileImageUrl = this.userService.profileImageUrl;

  dialog = viewChild.required<ElementRef<HTMLDialogElement>>('menu')
  private dialogIsOpen = false;

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

  protected toggleDarkMode(event: PointerEvent) {
    this.themeService.setDarkMode(!this.isDarkMode());
    event.stopPropagation();
  }
}
