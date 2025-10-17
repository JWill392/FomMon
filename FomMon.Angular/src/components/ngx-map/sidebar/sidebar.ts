import {Component, inject, OnInit, signal} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet} from "@angular/router";
import {filter} from "rxjs";
import {UserService} from "../../user/user.service";
import {SidebarItem} from "./sidebar-item/sidebar-item";
import {NgIconComponent, provideIcons} from "@ng-icons/core";
import {
  phosphorStack,
  phosphorBinoculars,
  phosphorCaretLeft,
  phosphorMagnifyingGlass
} from "@ng-icons/phosphor-icons/regular";
import {
  phosphorTreeEvergreenFill
} from "@ng-icons/phosphor-icons/fill";
import {LocalStorageService} from "../../shared/local-storage.service";

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterOutlet,
    RouterLink,
    SidebarItem,
    NgIconComponent
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  providers: [provideIcons({phosphorStack, phosphorBinoculars, phosphorCaretLeft,
    phosphorTreeEvergreenFill, phosphorMagnifyingGlass})]
})
class Sidebar implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private userService = inject(UserService);
  private localStorageService = inject(LocalStorageService);
  protected isAuthenticated = this.userService.state.isReady;

  private readonly localStorageKeyCollapsed = 'sidebar.collapsed';

  navCollapsed = signal<boolean>(false);
  contentClosed = signal<boolean>(true);


  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateContentVisibility();
    })
  }

  ngOnInit(): void {
    this.updateContentVisibility();
    this.navCollapsed.set(this.localStorageService.get(this.localStorageKeyCollapsed) ?? false);
  }

  private updateContentVisibility() {
    const hasActiveChild = this.activatedRoute.children.length > 0;
    this.contentClosed.update(_ => !hasActiveChild);
  }



  toggleNav() {
    this.navCollapsed.update(v => !v);
    this.localStorageService.set(this.localStorageKeyCollapsed, this.navCollapsed())
  }

}

export default Sidebar
