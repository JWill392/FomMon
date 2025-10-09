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
  private destroyRef = inject(DestroyRef);

  constructor(private layerService: LayerService,
              private userService: UserService,
              private awService: LayerService,
              private errorService: ErrorService,
              private notService: NotificationService) {
    // get config
    layerService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    // user service initialized on login

    // Initialize area watches only when authenticated
    effect(() => {
      const auth = this.userService.isAuthenticated();
      if (!auth) return;

      this.awService.initialize$()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
    });
  }
}
