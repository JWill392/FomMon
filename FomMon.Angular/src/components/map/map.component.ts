import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal, viewChild,
} from '@angular/core';
import {
  ControlComponent,
  LayerComponent,
  MapComponent as MglMapComponent,
  NavigationControlDirective,
  RasterSourceComponent,
  ScaleControlDirective,
} from '@maplibre/ngx-maplibre-gl';
import {Map as MapLibreMap} from 'maplibre-gl';
import {UserService} from '../user/user.service';
import {LayerConfigService} from '../layer-type/layer-config.service';
import {AreaAlertService} from '../area-alert/area-alert.service';
import {CommonModule} from '@angular/common';
import {AreaWatchLayer} from "./layer/area-watch-layer/area-watch-layer";
import {FeatureLayer} from "./layer/feature-layer/feature-layer";
import {MapLayerDirective} from "./layer/base-layer-switcher/map-layer.directive";
import {BaseLayerSwitcher} from "./layer/base-layer-switcher/base-layer-switcher";
import {MapLayerService} from "./layer/map-layer.service";
import {UserMenu} from "../user/user-menu/user-menu";
import {MapLayerGroupComponent} from "./layer/map-layer-group/map-layer-group.component";
import {Sidebar} from "./sidebar/sidebar";
import {AppConfigService} from "../../config/app-config.service";
import {MapInteraction} from "./map-interaction";
import {MapDrawing} from "./map-drawing";

@Component({
  selector: 'app-ngx-map',
  imports: [
    CommonModule,
    MglMapComponent,
    LayerComponent,
    ControlComponent,
    ScaleControlDirective,
    NavigationControlDirective,
    RasterSourceComponent,
    AreaWatchLayer,
    FeatureLayer,
    MapLayerDirective,
    BaseLayerSwitcher,
    MapLayerDirective,
    Sidebar,
    UserMenu,
    MapLayerGroupComponent,
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

  protected appConfig = inject(AppConfigService);
  protected mapLayerService = inject(MapLayerService);
  
  readonly map = signal<MapLibreMap | undefined>(undefined);

  protected mapInteraction = viewChild(MapInteraction);
  protected mapDrawing = viewChild(MapDrawing);

  protected domainLayers = this.layerConfigService.data;
  readonly isAuthenticated = this.userService.state.isReady;


  constructor() {
    // select

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
      if (!this.map()) return;

      for (const layer of this.mapLayerService.layers()) {
        this.map().moveLayer(layer.id);
      }
    })
  }


  onMapLoad(map: MapLibreMap) {
    // DEBUG tiles
    // map.showCollisionBoxes = true;
    // map.showTileBoundaries = true;
    this.map.set(map);

    this.mapDrawing().register(map);
  }






  // Problem: MapLibre disallows relative URLs, but they are required for proxy (angular in dev, docker-nginx in prod)
  // Workaround: use local://. prefix in MapLibre config and rewrite with transformRequest
  // Usage: use tile/sprite/glyph URLs like "local://./tileserver/project_features.1/{z}/{x}/{y}"
  transformLocalUrl = (url: string) => {
    if (/^local:\/\//.test(url)) {
      const protocol = window.location.protocol;
      const host = window.location.host;

      const strippedUrl = url.substr('local://'.length);

      return {url: new URL(protocol + '//' + host + '/' + strippedUrl).href};
    }
    return { url };
  };

}