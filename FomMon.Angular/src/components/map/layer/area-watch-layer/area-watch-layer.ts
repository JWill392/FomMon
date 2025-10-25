import {Component, computed, inject, OnInit} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent} from "@maplibre/ngx-maplibre-gl";
import {FeatureCollection} from "geojson";
import {MapLayerDirective} from "../base-layer-switcher/map-layer.directive";
import {MapLayerService} from "../map-layer.service";
import {MapLayerGroupComponent} from "../map-layer-group/map-layer-group.component";
import {AreaWatchLayerService} from "./area-watch-layer.service";
import {MapRoutingService} from "../../map-routing.service";
import {Router} from "@angular/router";
import {AreaWatchService} from "../../../area-watch/area-watch.service";
import {RoutePaths} from "../../../../app/app.routes";

@Component({
  selector: 'app-area-watch-layer',
  imports: [
    GeoJSONSourceComponent,
    LayerComponent,
    MapLayerDirective,
    MapLayerGroupComponent
  ],
  templateUrl: './area-watch-layer.html',
  styleUrl: './area-watch-layer.css'
})
export class AreaWatchLayer implements OnInit {
  protected mapLayerService = inject(MapLayerService);
  protected areaWatchLayerService = inject(AreaWatchLayerService);
  private areaWatchService = inject(AreaWatchService);
  private mapRoutingService = inject(MapRoutingService);
  private router = inject(Router);

  protected readonly sourceId = this.areaWatchLayerService.groupId;
  protected readonly groupId = this.areaWatchLayerService.groupId;
  readonly layerIdFill = `area-watch`;
  readonly layerIdOutline = `area-watch-outline`;
  readonly layerIdLabel = `area-watch-label`;

  data = this.areaWatchService.data;

  protected features = computed<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (this.data() ?? []).map((p) => {
      const {geometry, featureId, ...properties} = p;
      return {
        type: 'Feature' as const,
        geometry: geometry,
        properties: properties,
        id: featureId,
      }
    })
  }));

  ngOnInit(): void {
    this.mapRoutingService.registerLayerRouting(this.areaWatchLayerService.groupId, (featureId) => {
      const aw = this.areaWatchService.getByFeatureId(featureId.id);
      if (!aw) return;

      this.router.navigate([RoutePaths.areaWatchView(aw.id)]);
    });
  }
}
