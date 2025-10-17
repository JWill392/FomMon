import {Component, input, Input, output} from '@angular/core';
import {RouterLink, RouterLinkActive} from "@angular/router";
import {NgIcon, provideIcons} from "@ng-icons/core";

@Component({
  selector: 'app-sidebar-item',
  imports: [
    RouterLink,
    RouterLinkActive,
    NgIcon
  ],
  templateUrl: './sidebar-item.html',
  styleUrl: './sidebar-item.css'
})
export class SidebarItem {
  icon = input.required<string>();
  title = input.required<string>();
  collapsed = input.required<boolean>();

  link = input.required<string>();

}
