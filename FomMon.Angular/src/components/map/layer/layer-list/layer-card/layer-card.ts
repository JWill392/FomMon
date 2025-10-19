import {Component, computed, inject, input} from '@angular/core';
import {LayerGroup, MapLayerService} from "../../map-layer.service";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorEye, phosphorEyeSlash} from "@ng-icons/phosphor-icons/regular";

@Component({
  selector: 'app-layer-card',
  imports: [
    NgIcon
  ],
  templateUrl: './layer-card.html',
  styleUrl: './layer-card.css',
  providers: [provideIcons({phosphorEyeSlash, phosphorEye})],
  host: {
    '(click)': "toggleGroupVisibility(layerGroup().id)"
  }
})
export class LayerCard {
  layerGroupId = input.required<string>();
  mapLayerService = inject(MapLayerService);

  layerGroup = computed(() => this.mapLayerService.getGroup(this.layerGroupId()) as LayerGroup)

  protected toggleGroupVisibility(group: string): void {
    this.mapLayerService.setVisibility(group, !this.layerGroup().visible);
  }
}
