import {Component, computed, inject} from '@angular/core';
import {ControlComponent} from "@maplibre/ngx-maplibre-gl";
import {MapLayerService} from "../map-layer.service";

@Component({
  selector: 'app-base-layer-switcher',
  imports: [
    ControlComponent
  ],
  templateUrl: './base-layer-switcher.html',
  styleUrl: './base-layer-switcher.css'
})
export class BaseLayerSwitcher {
  private mapLayerService = inject(MapLayerService);

  protected layers = this.mapLayerService.layers;

  protected selectLayer(id: string): void {
    this.mapLayerService.selectLayer(id);
  }
}
