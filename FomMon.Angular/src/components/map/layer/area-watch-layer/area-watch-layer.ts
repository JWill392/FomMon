import {Component, computed, inject, input} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent} from "@maplibre/ngx-maplibre-gl";
import {FeatureCollection} from "geojson";
import {MapLayerDirective} from "../base-layer-switcher/map-layer.directive";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {AreaWatch} from "../../../area-watch/area-watch.model";
import {AreaWatchLayerService} from "./area-watch-layer.service";

@Component({
  selector: 'app-area-watch-layer',
  imports: [
    GeoJSONSourceComponent,
    LayerComponent,
    MapLayerDirective,
    MapLayerGroupComponent
  ],
  templateUrl: './area-watch-layer.html',
  styleUrl: './area-watch-layer.css'
})
export class AreaWatchLayer {
  protected mapLayerService = inject(MapLayerService);
  protected areaWatchLayerService = inject(AreaWatchLayerService);

  protected readonly sourceId = this.areaWatchLayerService.groupId;
  protected readonly groupId = this.areaWatchLayerService.groupId;
  readonly layerIdFill = `area-watch`;
  readonly layerIdOutline = `area-watch-outline`;
  readonly layerIdLabel = `area-watch-label`;

  data = input.required<AreaWatch[]>();

  protected features = computed<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (this.data() ?? []).map((p) => {
      const {geometry, featureId, ...properties} = p;
      return {
        type: 'Feature' as const,
        geometry: geometry,
        properties: properties,
        id: featureId,
      }
    })
  }));
}
