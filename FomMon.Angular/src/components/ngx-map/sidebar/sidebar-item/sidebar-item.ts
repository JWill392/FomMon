import {Component, input, Input} from '@angular/core';
import {RouterLink, RouterLinkActive} from "@angular/router";

@Component({
  selector: 'app-sidebar-item',
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './sidebar-item.html',
  styleUrl: './sidebar-item.css'
})
export class SidebarItem {
  icon = input.required<string>();
  title = input.required<string>();
  routerLink = input.required<string>();
  collapsed = input.required<boolean>();

}
