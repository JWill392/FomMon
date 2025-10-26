import {Component, inject} from '@angular/core';
import {MapLayerService} from "../map-layer.service";

@Component({
  selector: 'app-base-layer-switcher',
  templateUrl: './base-layer-switcher.html',
  styleUrl: './base-layer-switcher.scss',
})
export class BaseLayerSwitcher {
  private mapLayerService = inject(MapLayerService);

  protected baseGroups = this.mapLayerService.baseGroups;

  protected selectBaseGroup(groupId: string): void {
    this.mapLayerService.selectBaseLayer(groupId);
  }
}
