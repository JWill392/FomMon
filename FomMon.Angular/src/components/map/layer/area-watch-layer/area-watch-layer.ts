import {Component, inject, OnInit} from '@angular/core';
import {FeatureComponent, GeoJSONSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {AreaWatchLayerService} from "./area-watch-layer.service";
import {MapRoutingService} from "../../map-routing.service";
import {Router} from "@angular/router";
import {AreaWatchService} from "../../../area-watch/area-watch.service";
import {RoutePaths} from "../../../../routes/app.routes";
import {AreaWatch} from "../../../area-watch/area-watch.model";
import {AppLayerComponent} from "../app-layer/app-layer.component";

@Component({
  selector: 'app-area-watch-layer',
  imports: [
    GeoJSONSourceComponent,
    MapLayerGroupComponent,
    FeatureComponent,
    AppLayerComponent
  ],
  templateUrl: './area-watch-layer.html',
  styles: ['']
})
export class AreaWatchLayer implements OnInit {
  protected mapLayerService = inject(MapLayerService);
  protected areaWatchLayerService = inject(AreaWatchLayerService);
  private areaWatchService = inject(AreaWatchService);
  private mapRoutingService = inject(MapRoutingService);
  private router = inject(Router);

  protected readonly sourceId = this.areaWatchLayerService.groupId;
  protected readonly groupId = this.areaWatchLayerService.groupId;

  areaWatches = this.areaWatchService.data;

  protected asFeatureFields({geometry, featureId, ...properties}: AreaWatch) {
    return {geometry, featureId, properties};
  }

  ngOnInit(): void {

    this.mapRoutingService.registerLayerRouting(this.areaWatchLayerService.groupId, (featureId) => {
      const aw = this.areaWatchService.getByFeatureId(featureId.id);
      if (!aw) return;

      this.router.navigate([RoutePaths.areaWatchView({id: aw.id})]);
    });
  }
}
