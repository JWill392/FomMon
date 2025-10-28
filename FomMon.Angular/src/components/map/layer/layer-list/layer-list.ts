import {Component, inject} from '@angular/core';
import {MapLayerService} from "../map-layer.service";

import {LayerCard} from "./layer-card/layer-card";
import {LoaderComponent} from "../../../shared/loader/loader.component";
import {LayerConfigService} from "../../../layer-type/layer-config.service";

@Component({
  selector: 'app-layer-list',
  imports: [
    LayerCard,
    LoaderComponent
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerList {
  private mapLayerService = inject(MapLayerService);
  protected layerConfigService = inject(LayerConfigService);
  protected featureGroups = this.mapLayerService.featureGroups;

}
