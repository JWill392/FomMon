import {Component, input} from '@angular/core';
import {LayerComponent, VectorSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {LayerType} from "../../../layer-type/layer-type.model";

@Component({
  selector: 'app-feature-layer',
  imports: [
    LayerComponent,
    VectorSourceComponent
  ],
  templateUrl: './feature-layer.html',
  styleUrl: './feature-layer.css'
})
export class FeatureLayer {
  layer = input.required<LayerType>();
  url = input.required<string>();
}
