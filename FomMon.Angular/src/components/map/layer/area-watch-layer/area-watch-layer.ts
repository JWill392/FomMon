import {Component, computed, inject} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent} from "@maplibre/ngx-maplibre-gl";
import {FeatureCollection} from "geojson";
import {AreaWatchService} from "../../../area-watch/area-watch.service";
import {MapLayerDirective} from "../base-layer-switcher/map-layer.directive";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";

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
  private areaWatchService = inject(AreaWatchService);
  protected mapLayerService = inject(MapLayerService);

  public static readonly layerGroupId = 'area-watches';
  protected readonly layerGroupId = AreaWatchLayer.layerGroupId; //template access

  protected areaWatchFeatures = computed<FeatureCollection>(() => ({
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
}
