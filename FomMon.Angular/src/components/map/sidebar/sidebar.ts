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
import {AppConfigService} from "../../../config/app-config.service";
import {MatIconButton} from "@angular/material/button";
import {MatActionList, MatListItem} from "@angular/material/list";

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterOutlet,
    RouterLink,
    SidebarItem,
    NgIconComponent,
    MatIconButton,
    MatActionList,
    MatListItem
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  providers: [provideIcons({phosphorStack, phosphorBinoculars, phosphorCaretLeft,
    phosphorTreeEvergreenFill, phosphorX})],
  host: {
    '[style.--nav-width.px]': 'navWidth()',
    '[style.--content-width.px]': '_contentWidth()',
    '[style.--animation-duration.ms]': '_animationDurationMs',
  }
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

  private readonly localStorageKeyCollapsed = {key: 'sidebar.collapsed', version: 1} as const;

  navCollapsed = signal<boolean>(false);
  contentClosed = signal<boolean>(true);

  protected sidebarWidth = computed(() => this.navWidth() + this._contentWidth());
  protected navWidth = computed(() => this.navCollapsed() ? 41 : 110);
  protected _contentWidth = computed(() => this.contentClosed() ? 0 : 250);
  protected readonly _animationDurationMs = 200;

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateContentVisibility();
    })

    effect(() => {
      const sidebarWidth = this.sidebarWidth();

      this.mapStateService.padding.update((v) => ({
        ...v,
        left: sidebarWidth
      }));
    });
  }


  ngOnInit(): void {
    this.updateContentVisibility();
    this.navCollapsed.set(this.localStorageService.get(this.localStorageKeyCollapsed) ?? false);
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
    this.localStorageService.set(this.localStorageKeyCollapsed, this.navCollapsed())
  }

  protected onBack($event: PointerEvent) {
    $event.stopPropagation();
    const current = this.router.url;
    const parent = getParentRoute(current);
    this.router.navigate([parent], {preserveFragment: true});
  }
}

