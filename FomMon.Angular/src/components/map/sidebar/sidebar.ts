import {Component, computed, effect, HostBinding, inject, OnInit, signal} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet} from "@angular/router";
import {filter} from "rxjs";
import {UserService} from "../../user/user.service";
import {SidebarItem} from "./sidebar-item/sidebar-item";
import {NgIconComponent, provideIcons} from "@ng-icons/core";
import {
  phosphorBinoculars,
  phosphorCaretLeft,
  phosphorStack
} from "@ng-icons/phosphor-icons/regular";
import {phosphorTreeEvergreenFill} from "@ng-icons/phosphor-icons/fill";
import {LocalStorageService} from "../../shared/local-storage.service";
import {MapStateService} from "../map-state.service";
import {RoutePaths} from "../../../app/app.routes";

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
    phosphorTreeEvergreenFill})]
})
export class Sidebar implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private userService = inject(UserService);
  private localStorageService = inject(LocalStorageService);
  private mapStateService = inject(MapStateService);
  protected isAuthenticated = this.userService.state.isReady;

  private readonly localStorageKeyCollapsed = 'sidebar.collapsed';

  navCollapsed = signal<boolean>(false);
  contentClosed = signal<boolean>(true);

  private _sidebarWidth = computed(() => this._navWidth() + this._contentWidth());
  private _navWidth = computed(() => this.navCollapsed() ? 41 : 110);
  @HostBinding('style.--nav-width')
  get cssNavWidth() {return `${this._navWidth()}px`;}

  private _contentWidth = computed(() => this.contentClosed() ? 0 : 250);
  @HostBinding('style.--content-width')
  get cssContentWidth() {return `${this._contentWidth()}px`;}

  private readonly _animationDurationMs = 200;
  @HostBinding('style.--animation-duration')
  get cssAnimationDuration() {return `${this._animationDurationMs}ms`;}

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateContentVisibility();
    })

    effect(() => {
      const sidebarWidth = this._sidebarWidth();

      this.mapStateService.padding.update((v) => ({
        padding: {
          ...v.padding,
          left: sidebarWidth
        },
        durationMs: this._animationDurationMs,
      }));
    });
  }


  ngOnInit(): void {
    this.updateContentVisibility();
    this.navCollapsed.set(this.localStorageService.get(this.localStorageKeyCollapsed, 1) ?? false);
  }


  private updateContentVisibility() {
    const hasActiveChild = this.activatedRoute.children.length > 0;
    this.contentClosed.update(_ => !hasActiveChild);
  }

  toggleNav() {
    this.navCollapsed.update(v => !v);
    this.localStorageService.set(this.localStorageKeyCollapsed, this.navCollapsed(), 1)
  }


  protected readonly RoutePaths = RoutePaths;
}

