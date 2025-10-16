import {Component, inject, input} from '@angular/core';
import {LayerComponent, VectorSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {LayerType} from "../../../layer-type/layer-type.model";
import {MapLayerDirective} from "../base-layer-switcher/map-layer.directive";
import {MapLayerService} from "../map-layer.service";

@Component({
  selector: 'app-feature-layer',
  imports: [
    LayerComponent,
    VectorSourceComponent,
    MapLayerDirective
  ],
  templateUrl: './feature-layer.html',
  styleUrl: './feature-layer.css'
})
export class FeatureLayer {
  mapLayerService = inject(MapLayerService);
  layer = input.required<LayerType>();
  url = input.required<string>();
}
