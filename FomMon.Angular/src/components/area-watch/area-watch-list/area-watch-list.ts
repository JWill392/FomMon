import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {AreaWatchCard} from '../area-watch-card/area-watch-card';
import {RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MapLayerService} from "../../map/layer/map-layer.service";
import {RoutePaths} from "../../../routes/app.routes";
import {LoaderComponent} from "../../shared/loader/loader.component";
import {AreaWatchLayerService} from "../../map/layer/area-watch-layer/area-watch-layer.service";

@Component({
  selector: 'app-area-watch-list',
  imports: [
    AreaWatchCard,
    RouterLink,
    LoaderComponent
  ],
  templateUrl: './area-watch-list.html',
  styleUrl: './area-watch-list.scss'
})
export class AreaWatchList implements OnInit {
  awService = inject(AreaWatchService);
  private mapLayerService = inject(MapLayerService);
  private areaWatchLayerService = inject(AreaWatchLayerService);
  private readonly groupId = this.areaWatchLayerService.groupId;
  destroyRef = inject(DestroyRef);


  // TODO should ensure areawatch layer is visible when open
  ngOnInit(): void {
    this.awService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    this.ensureLayerVisible();
  }


  private ensureLayerVisible() {
    const visibilitySnapshotName = 'AreaWatchList' as const
    this.mapLayerService.pushVisibilitySnapshot(visibilitySnapshotName);
    this.mapLayerService.setVisibility(this.groupId, true, visibilitySnapshotName);

    this.destroyRef.onDestroy(() => this.mapLayerService.popVisibilitySnapshot(visibilitySnapshotName));
  }

  protected readonly RoutePaths = RoutePaths;
}
