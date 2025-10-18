import {Component, computed, inject, OnDestroy} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent} from "@maplibre/ngx-maplibre-gl";
import {FeatureCollection} from "geojson";
import {AreaWatchService} from "../../../area-watch/area-watch.service";
import {MapLayerDirective} from "../base-layer-switcher/map-layer.directive";
import {MapLayerService} from "../map-layer.service";

@Component({
  selector: 'app-area-watch-layer',
  imports: [
    GeoJSONSourceComponent,
    LayerComponent,
    MapLayerDirective
  ],
  templateUrl: './area-watch-layer.html',
  styleUrl: './area-watch-layer.css'
})
export class AreaWatchLayer {
  private areaWatchService = inject(AreaWatchService);
  protected mapLayerService = inject(MapLayerService);

  public readonly layerGroupId = 'area-watches';

  protected areaWatchFeatures = computed<FeatureCollection>(() => {
    return {
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
    }
  });
}
