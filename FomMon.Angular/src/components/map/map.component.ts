import {ChangeDetectionStrategy, Component, effect, inject, signal, untracked, viewChild,} from '@angular/core';
import {
  ControlComponent,
  MapComponent as MglMapComponent,
  NavigationControlDirective,
  ScaleControlDirective,
} from '@maplibre/ngx-maplibre-gl';
import {Map as MapLibreMap} from 'maplibre-gl';
import {UserService} from '../user/user.service';
import {LayerConfigService} from '../layer-type/layer-config.service';
import {AreaAlertService} from '../area-alert/area-alert.service';
import {CommonModule} from '@angular/common';
import {AreaWatchLayer} from "./layer/area-watch-layer/area-watch-layer";
import {FeatureLayer} from "./layer/feature-layer/feature-layer";
import {MapLayerService} from "./layer/map-layer.service";
import {UserMenu} from "../user/user-menu/user-menu";
import {Sidebar} from "./sidebar/sidebar";
import {AppConfigService} from "../../config/app-config.service";
import {MapInteraction} from "./map-interaction";
import {MapDrawing} from "./map-drawing";
import {MapDisplayService} from "./map-display.service";
import {AppMapService} from "./app-map.service";
import {AreaWatchService} from "../area-watch/area-watch.service";

@Component({
  selector: 'app-ngx-map',
  imports: [
    CommonModule,
    MglMapComponent,
    ControlComponent,
    ScaleControlDirective,
    NavigationControlDirective,
    AreaWatchLayer,
    FeatureLayer,
    Sidebar,
    UserMenu,
    MapInteraction,
    MapDrawing,
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppMapComponent {
  private layerConfigService = inject(LayerConfigService);
  private userService = inject(UserService);
  private areaAlertService = inject(AreaAlertService);
  private mapService = inject(AppMapService);
  private areaWatchService = inject(AreaWatchService);

  protected appConfig = inject(AppConfigService);
  protected mapLayerService = inject(MapLayerService);
  protected mapDisplayService =  inject(MapDisplayService);

  readonly map = signal<MapLibreMap | undefined>(undefined);

  protected mapInteraction = viewChild(MapInteraction);

  protected domainLayers = this.layerConfigService.data;
  protected readonly isAuthenticated = this.userService.state.isReady;
  protected readonly isAreaWatchReady = this.areaWatchService.state.isReady;


  constructor() {
    // TODO move alert highlighting to its own layer
    effect((onCleanup) => {
      const alertList = this.areaAlertService.data();
      const map = this.map();

      if (!map || !alertList) return;

      const alertFids = alertList.map((a) => this.areaAlertService.getFeatureId(a));

      for (const fid of alertFids) {
        map.setFeatureState(fid, {alert: true});
      }

      onCleanup(() => {
        for (const fid of alertFids) {
          if (!map.isSourceLoaded(fid.source)) continue;
          map.setFeatureState(fid, {alert: false});
        }
      })
    });


    // optional: update map vanishing point on sidebar open/close.  maybe a bit much
    // effect(() => {
    //   const padding = this.mapStateService.padding();
    //   const map = this.map();
    //
    //   if (!map) return;
    //   map.easeTo({padding})
    // })

    // handle layer order change
    effect(() => {
      this.mapLayerService.layerOrderSignature();
      const map = this.map();
      if (!map) return;

      const layerOrder = untracked(() => this.mapLayerService.layers()); // ignore visibility changes etc

      // async to avoid effect loops
      queueMicrotask(() => {
        // move all layers to top; reset order to match mapLayerService.layers()
        for (const layer of layerOrder) {
          map.moveLayer(layer.id);
        }
      })
    })
  }

  onMapLoad(map: MapLibreMap) {
    this.map.set(map)
    this.mapService.register(map);
  }






}