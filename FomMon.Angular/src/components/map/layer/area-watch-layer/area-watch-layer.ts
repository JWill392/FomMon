import {Component, computed, inject, OnInit} from '@angular/core';
import {GeoJSONSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {MapRoutingService} from "../../map-routing.service";
import {AreaWatchService} from "../../../area-watch/area-watch.service";
import {RoutePaths} from "../../../../routes/app.routes";
import {MapLayerComponent} from "../app-layer/map-layer.component";
import {FeatureCollection} from "geojson";
import {MapStyleIsStatePipe} from "../map-style-util";

@Component({
  selector: 'app-area-watch-layer',
  imports: [
    GeoJSONSourceComponent,
    MapLayerGroupComponent,
    MapLayerComponent,
    MapStyleIsStatePipe
  ],
  templateUrl: './area-watch-layer.html',
  styles: ['']
})
export class AreaWatchLayer implements OnInit {
  protected mapLayerService = inject(MapLayerService);
  private areaWatchService = inject(AreaWatchService);
  private mapRoutingService = inject(MapRoutingService);

  protected readonly sourceId = this.areaWatchService.sourceId;
  protected readonly groupId = this.areaWatchService.groupId;

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

  protected readonly selectedColor = '#FFB347';
  protected readonly color = '#3bb2d0';

  ngOnInit(): void {
    this.mapRoutingService.registerSelectRouting(this.areaWatchService.groupId, (featureId) => {
      if (!featureId.id) return undefined;
      const aw = this.areaWatchService.getByFeatureId(featureId.id);
      if (!aw) return undefined;

      return { commands: [RoutePaths.areaWatchView({id: aw.id})] };
    });
  }

}
