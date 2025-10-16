import {Component, effect, inject, OnInit, signal} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from "@angular/router";
import {filter} from "rxjs";
import {HasRolesDirective} from "keycloak-angular";
import {ControlComponent} from "@maplibre/ngx-maplibre-gl";
import {UserService} from "../../user/user.service";
import {SidebarItem} from "./sidebar-item/sidebar-item";

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    HasRolesDirective,
    ControlComponent,
    SidebarItem
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private userService = inject(UserService);

  navCollapsed = signal<boolean>(false);
  contentClosed = signal<boolean>(true);


  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateContentVisibility();
    })

    effect(() => {
      this.userService.state.isReady();
      this.updateContentVisibility();
    })
  }

  ngOnInit(): void {
    this.updateContentVisibility();
  }

  private updateContentVisibility() {
    const hasActiveChild = this.activatedRoute.children.length > 0;
    this.contentClosed.update(v => !hasActiveChild);
  }

  // TODO check if router content empty; hide


  toggleNav() {
    this.navCollapsed.update(v => !v);
    // TODO save in local storage
  }

}
