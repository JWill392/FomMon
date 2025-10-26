import {Component, inject} from '@angular/core';
import {MapLayerService} from "../map-layer.service";

import {LayerCard} from "./layer-card/layer-card";

@Component({
  selector: 'app-layer-list',
  imports: [
    LayerCard
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerList {
  private mapLayerService = inject(MapLayerService);
  protected featureGroups = this.mapLayerService.featureGroups;

}
