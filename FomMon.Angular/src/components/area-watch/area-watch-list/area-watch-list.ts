import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {AreaWatchCard} from '../area-watch-card/area-watch-card';
import {RouterLink} from '@angular/router';
import {MapLayerService} from "../../map/layer/map-layer.service";
import {RoutePaths} from "../../../routes/app.routes";
import {LoaderComponent} from "../../shared/loader/loader.component";
import {MatActionList, MatList, MatListItem} from "@angular/material/list";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorPlus} from "@ng-icons/phosphor-icons/regular";

@Component({
  selector: 'app-area-watch-list',
  imports: [
    AreaWatchCard,
    RouterLink,
    LoaderComponent,
    MatActionList,
    MatListItem,
    NgIcon,
    MatList
  ],
  templateUrl: './area-watch-list.html',
  styleUrl: './area-watch-list.scss',
  providers: [provideIcons({phosphorPlus})],
})
export class AreaWatchList implements OnInit {
  areaWatchService = inject(AreaWatchService);
  private mapLayerService = inject(MapLayerService);
  destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.ensureLayerVisible();
  }


  private ensureLayerVisible() {
    const visibilitySnapshotName = 'AreaWatchList' as const
    this.mapLayerService.pushVisibilitySnapshot(visibilitySnapshotName);
    this.mapLayerService.setVisibility(this.areaWatchService.groupId, true, visibilitySnapshotName);

    this.destroyRef.onDestroy(() => this.mapLayerService.popVisibilitySnapshot(visibilitySnapshotName));
  }

  protected readonly RoutePaths = RoutePaths;
}
