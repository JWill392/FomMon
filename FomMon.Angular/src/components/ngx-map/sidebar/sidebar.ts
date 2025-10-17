import {Component, effect, inject, OnInit, signal} from '@angular/core';
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
  protected isAuthenticated = this.userService.state.isReady;

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
    this.contentClosed.update(_ => !hasActiveChild);
  }

  // TODO check if router content empty; hide


  toggleNav() {
    this.navCollapsed.update(v => !v);
    // TODO save in local storage
  }

}

export default Sidebar
