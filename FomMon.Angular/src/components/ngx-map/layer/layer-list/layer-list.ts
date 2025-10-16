import {Component, inject} from '@angular/core';
import {MapLayerService} from "../map-layer.service";

@Component({
  selector: 'app-layer-list',
  imports: [],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.css'
})
export class LayerList {
  private mapLayerService = inject(MapLayerService);
  protected featureLayers = this.mapLayerService.featureLayers;

  protected toggleGroupVisibility(group: string): void {
    this.mapLayerService.toggleVisibility(group);
  }
}
