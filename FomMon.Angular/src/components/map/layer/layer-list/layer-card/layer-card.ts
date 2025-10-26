import {Component, computed, inject, input} from '@angular/core';
import {LayerGroup, MapLayerService} from "../../map-layer.service";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorEye, phosphorEyeSlash} from "@ng-icons/phosphor-icons/regular";
import {Card, CardAction, CardLabel, CardThumb} from "../../../../shared/card/card";

@Component({
  selector: 'app-layer-card',
  imports: [
    NgIcon,
    Card,
    CardThumb,
    CardLabel,
    CardAction
  ],
  templateUrl: './layer-card.html',
  styleUrl: './layer-card.scss',
  providers: [provideIcons({phosphorEyeSlash, phosphorEye})],
})
export class LayerCard {
  layerGroupId = input.required<string>();
  mapLayerService = inject(MapLayerService);

  isOdd = input.required<boolean>();
  layerGroup = computed(() => this.mapLayerService.getGroup(this.layerGroupId()) as LayerGroup)

  protected toggleVisibility(): void {
    this.mapLayerService.setVisibility(this.layerGroupId(), !this.layerGroup().visible);
  }
}
