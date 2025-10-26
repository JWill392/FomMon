import {Component, computed, effect, HostBinding, inject, OnInit, signal} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet} from "@angular/router";
import {filter} from "rxjs";
import {UserService} from "../../user/user.service";
import {SidebarItem} from "./sidebar-item/sidebar-item";
import {NgIconComponent, provideIcons} from "@ng-icons/core";
import {
  phosphorBinoculars,
  phosphorCaretLeft,
  phosphorStack, phosphorX
} from "@ng-icons/phosphor-icons/regular";
import {phosphorTreeEvergreenFill} from "@ng-icons/phosphor-icons/fill";
import {LocalStorageService} from "../../shared/local-storage.service";
import {MapStateService} from "../map-state.service";
import {getParentRoute, RoutePaths} from "../../../routes/app.routes";
import {Location} from "@angular/common";
import {AppConfigService} from "../../../config/app-config.service";

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterOutlet,
    RouterLink,
    SidebarItem,
    NgIconComponent
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  providers: [provideIcons({phosphorStack, phosphorBinoculars, phosphorCaretLeft,
    phosphorTreeEvergreenFill, phosphorX})]
})
export class Sidebar implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private userService = inject(UserService);
  private localStorageService = inject(LocalStorageService);
  private mapStateService = inject(MapStateService);
  protected config = inject(AppConfigService)

  protected isAuthenticated = this.userService.state.isReady;
  protected readonly RoutePaths = RoutePaths;
  protected readonly contentTitle = signal<string>('');

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
        ...v,
        left: sidebarWidth
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

    let leaf = this.activatedRoute;
    while (leaf.firstChild) leaf = leaf.firstChild;

    this.contentTitle.set(hasActiveChild ? leaf.snapshot.title : '');
  }

  protected toggleNav() {
    this.navCollapsed.update(v => !v);
    this.localStorageService.set(this.localStorageKeyCollapsed, this.navCollapsed(), 1)
  }

  protected onBack($event: PointerEvent) {
    $event.stopPropagation();
    const current = this.router.url;
    const parent = getParentRoute(current);
    this.router.navigate([parent], {preserveFragment: true});
  }
}

