import {Component, DestroyRef, effect, inject, Injectable} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import {Snackbar} from '../components/shared/snackbar/snackbar';
import {LayerConfigService} from '../components/layer-type/layer-config.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {UserService} from '../components/user/user.service';
import {AreaAlertService} from "../components/area-alert/area-alert.service";
import {ProjectService} from "../components/project/project.service";
import {AreaWatchService} from "../components/area-watch/area-watch.service";

@Injectable()
@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, Snackbar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private layerService = inject(LayerConfigService)
  private projectService = inject(ProjectService)

  private userService = inject(UserService)
  private areaWatchService = inject(AreaWatchService)
  private areaAlertService = inject(AreaAlertService)

  private destroyRef = inject(DestroyRef);

  constructor() {
    // get config
    this.layerService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    this.projectService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    // user service initialized on login

    // authenticated services
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
