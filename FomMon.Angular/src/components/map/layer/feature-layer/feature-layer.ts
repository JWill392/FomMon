import {Component, computed, inject, input} from '@angular/core';
import {VectorSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {LayerType} from "../../../layer-type/layer-type.model";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {LayerConfigService} from "../../../layer-type/layer-config.service";
import {AppLayerComponent} from "../app-layer/app-layer.component";

@Component({
  selector: 'app-feature-layer',
  imports: [
    VectorSourceComponent,
    MapLayerGroupComponent,
    AppLayerComponent
  ],
  templateUrl: './feature-layer.html',
  styles: ['']
})

// TODO make features composite source; seems faster
export class FeatureLayer {
  protected layerConfigService = inject(LayerConfigService);
  protected mapLayerService = inject(MapLayerService);
  layer = input.required<LayerType>();
  url = input.required<string>();

  protected groupId = computed(() => this.layerConfigService.getGroupId(this.layer().kind))

}
