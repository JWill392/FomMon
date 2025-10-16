import {Component, inject} from '@angular/core';
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

  protected baseLayers = this.mapLayerService.baseLayers;

  protected selectBaseLayer(id: string): void {
    this.mapLayerService.selectBaseLayer(id);
  }
}
