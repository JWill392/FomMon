import {Component, inject, input} from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from "@angular/router";
import {NgIcon} from "@ng-icons/core";

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
  closeLink = input.required<string>();

  private router = inject(Router)

  onClickToggleRouting(event: PointerEvent, isActive: boolean) {
    if (isActive) {
      event.stopPropagation();

      this.router.navigate([this.closeLink()], {preserveFragment: true})
    }
  }
}
