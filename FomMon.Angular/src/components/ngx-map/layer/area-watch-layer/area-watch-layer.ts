import {Component, computed, inject} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent} from "@maplibre/ngx-maplibre-gl";
import {FeatureCollection} from "geojson";
import {AreaWatchService} from "../../../area-watch/area-watch.service";

@Component({
  selector: 'app-area-watch-layer',
  imports: [
    GeoJSONSourceComponent,
    LayerComponent
  ],
  templateUrl: './area-watch-layer.html',
  styleUrl: './area-watch-layer.css'
})
export class AreaWatchLayer {
  private areaWatchService = inject(AreaWatchService);

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
