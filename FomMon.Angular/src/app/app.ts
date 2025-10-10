import {Component, DestroyRef, effect, inject, Injectable, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import {MenuComponent} from "../components/menu/menu";
import {Snackbar} from '../components/shared/snackbar/snackbar';
import {ErrorService} from '../components/shared/error.service';
import {NotificationService} from '../components/shared/snackbar/notification.service';
import {LayerService} from '../components/layer/layer.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {UserService} from '../components/user/user.service';
import {AreaAlertService} from "../components/area-alert/area-alert.service";

@Injectable()
@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, MenuComponent, Snackbar],
  template: `
    <app-snackbar />
    <app-menu></app-menu>
    <main>
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    :host {display: flex; flex-direction: column; height: 100vh;}
    main {flex: 1 0 auto;}
  `],
})
export class App {
  private layerService = inject(LayerService)
  private userService = inject(UserService)
  private areaWatchService = inject(LayerService)
  private areaAlertService = inject(AreaAlertService)

  private errorService = inject(ErrorService)
  private notService = inject(NotificationService)

  private destroyRef = inject(DestroyRef);

  constructor() {
    // get config
    this.layerService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    // user service initialized on login

    // Initialize area watches only when authenticated
    effect(() => {
      const auth = this.userService.state.isReady();
      if (!auth) return;

      this.areaWatchService.initialize$()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();

      this.areaAlertService.initialize$()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe()
    });
  }
}
