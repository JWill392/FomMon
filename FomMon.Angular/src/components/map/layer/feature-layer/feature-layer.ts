import {Component, computed, inject, input} from '@angular/core';
import {LayerComponent, VectorSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {LayerType} from "../../../layer-type/layer-type.model";
import {MapLayerDirective} from "../base-layer-switcher/map-layer.directive";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {LayerConfigService} from "../../../layer-type/layer-config.service";

@Component({
  selector: 'app-feature-layer',
  imports: [
    LayerComponent,
    VectorSourceComponent,
    MapLayerDirective,
    MapLayerGroupComponent
  ],
  templateUrl: './feature-layer.html',
  styleUrl: './feature-layer.scss'
})
export class FeatureLayer {
  protected layerConfigService = inject(LayerConfigService);
  protected mapLayerService = inject(MapLayerService);
  layer = input.required<LayerType>();
  url = input.required<string>();

  protected groupId = computed(() => this.layerConfigService.getGroupId(this.layer().kind))

}
