import {Component, DestroyRef, inject, OnDestroy, OnInit} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {AreaWatchCard} from '../area-watch-card/area-watch-card';
import {RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MapLayerService} from "../../map/layer/map-layer.service";
import {RoutePaths} from "../../../routes/app.routes";

@Component({
  selector: 'app-area-watch-list',
  imports: [
    AreaWatchCard,
    RouterLink
  ],
  templateUrl: './area-watch-list.html',
  styleUrl: './area-watch-list.scss'
})
export class AreaWatchList implements OnInit, OnDestroy {
  awService = inject(AreaWatchService);
  private mapLayerService = inject(MapLayerService);
  destroyRef = inject(DestroyRef);

  private oldLayerVisibility: boolean;

  // TODO should ensure areawatch layer is visible when open
  ngOnInit(): void {
    this.awService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    this.setLayerVisible();
  }

  ngOnDestroy(): void {
    this.restoreLayerVisibility();
  }


  private setLayerVisible() {
    const awLayerGroup = this.mapLayerService.getGroup('area-watches');
    this.oldLayerVisibility = awLayerGroup?.visible ?? true;
    this.mapLayerService.setVisibility('area-watches', true);
  }

  private restoreLayerVisibility() {
    this.mapLayerService.setVisibility('area-watches', this.oldLayerVisibility);
  }

  protected readonly RoutePaths = RoutePaths;
}
