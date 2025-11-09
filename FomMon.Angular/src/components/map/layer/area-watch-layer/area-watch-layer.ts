import {Component, computed, inject, OnInit} from '@angular/core';
import {GeoJSONSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {AreaWatchLayerService} from "./area-watch-layer.service";
import {MapRoutingService} from "../../map-routing.service";
import {Router} from "@angular/router";
import {AreaWatchService} from "../../../area-watch/area-watch.service";
import {RoutePaths} from "../../../../routes/app.routes";
import {AppLayerComponent} from "../app-layer/app-layer.component";
import {FeatureCollection} from "geojson";

@Component({
  selector: 'app-area-watch-layer',
  imports: [
    GeoJSONSourceComponent,
    MapLayerGroupComponent,
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

  protected readonly featureCollection = computed<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (this.areaWatchService.data() ?? []).map((p) => {
      const {geometry, featureId, ...properties} = p;
      return {
        type: 'Feature' as const,
        geometry: geometry,
        properties: properties,
        id: featureId,
      }
    })
  }));

  ngOnInit(): void {

    this.mapRoutingService.registerLayerRouting(this.areaWatchLayerService.groupId, (featureId) => {
      const aw = this.areaWatchService.getByFeatureId(featureId.id);
      if (!aw) return;

      this.router.navigate([RoutePaths.areaWatchView({id: aw.id})]);
    });
  }
}
