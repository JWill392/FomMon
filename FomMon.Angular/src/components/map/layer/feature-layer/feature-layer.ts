import {Component, computed, inject, input, OnInit} from '@angular/core';
import {VectorSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {LayerType} from "../../../layer-type/layer-type.model";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {LayerConfigService} from "../../../layer-type/layer-config.service";
import {MapLayerComponent} from "../app-layer/map-layer.component";
import {RoutePaths} from "../../../../routes/app.routes";
import {MapRoutingService} from "../../map-routing.service";
import {MapStyleIsStatePipe} from "../map-style-util";

@Component({
  selector: 'app-feature-layer',
  imports: [
    VectorSourceComponent,
    MapLayerGroupComponent,
    MapLayerComponent,
    MapStyleIsStatePipe
  ],
  templateUrl: './feature-layer.html',
  styles: ['']
})

// TODO make features composite source; seems faster
export class FeatureLayer implements OnInit {
  protected layerConfigService = inject(LayerConfigService);
  protected mapLayerService = inject(MapLayerService);
  private mapRoutingService = inject(MapRoutingService);

  layer = input.required<LayerType>();
  url = input.required<string>();

  protected groupId = computed(() => this.layerConfigService.getGroupId(this.layer().kind))

  ngOnInit(): void {
    this.mapRoutingService.registerSelectRouting(this.groupId(), (featureId) => {
      if (!featureId.id) return undefined; // feature missing id; shouldn't happen
      return { commands: [RoutePaths.featureView({kind: this.layer().kind, id: featureId.id.toString()})] };
    });
  }
}
