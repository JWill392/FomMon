import {Component, computed, DestroyRef, inject, input, OnInit} from '@angular/core';
import {VectorSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {LayerType} from "../../../layer-type/layer-type.model";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {LayerConfigService} from "../../../layer-type/layer-config.service";
import {MapLayerComponent} from "../app-layer/map-layer.component";
import {RoutePaths} from "../../../../routes/app.routes";
import {MapRoutingService} from "../../map-routing.service";
import {MapStyleIsStatePipe} from "../map-style-util";
import {MapGeoJSONFeature} from "maplibre-gl";
import {MapFeatureService} from "../../../feature/map-feature.service";

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

export class FeatureLayer implements OnInit {
  private mapFeatureService = inject(MapFeatureService);
  protected layerConfigService = inject(LayerConfigService);
  protected mapLayerService = inject(MapLayerService);
  private mapRoutingService = inject(MapRoutingService);
  private destroyRef = inject(DestroyRef);

  layer = input.required<LayerType>();
  url = input.required<string>();

  protected groupId = computed(() => this.layerConfigService.getGroupId(this.layer().kind))

  ngOnInit(): void {
    this.mapRoutingService.registerSelectRouting(this.groupId(), (featureId) => {
      if (!featureId.id) return undefined; // feature missing id; shouldn't happen
      return { commands: [RoutePaths.featureView({kind: this.layer().kind, id: featureId.id.toString()})] };
    });
  }

  protected onBeforeSelect(feature: MapGeoJSONFeature) {
      const appFeature = this.mapFeatureService.asAppFeature(feature);
      // cache clicked feature data -- needed b/c MapLibre Vector layers can't reliably retrieve by ID (must be in viewport)
      this.mapFeatureService.addCache(appFeature); // cache should be cleared by component using data
      this.destroyRef.onDestroy(() => this.mapFeatureService.removeCache(appFeature));
  }
}
