import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  ControlComponent,
  LayerComponent,
  MapComponent as MglMapComponent,
  NavigationControlDirective,
  RasterSourceComponent,
  ScaleControlDirective,
} from '@maplibre/ngx-maplibre-gl';
import {Map as MapLibreMap, MapMouseEvent} from 'maplibre-gl';
import {MaplibreTerradrawControl} from '@watergis/maplibre-gl-terradraw';
import {TerraDraw} from 'terra-draw';
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
import {DrawCommand, FlyToCommand, MapStateService} from "./map-state.service";
import {ErrorService} from "../shared/error.service";
import {MapLayerGroupComponent} from "./layer/map-layer-group/map-layer-group.component";
import {boundingBox} from "./map-util";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Sidebar} from "./sidebar/sidebar";
import {AppConfigService} from "../../config/app-config.service";
import {v4 as uuidv4} from 'uuid';
import {Geometry} from "geojson";

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
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapComponent {
  private layerConfigService = inject(LayerConfigService);
  private userService = inject(UserService);
  private areaAlertService = inject(AreaAlertService);
  private errorService = inject(ErrorService);
  private destroyRef = inject(DestroyRef);

  protected appConfig = inject(AppConfigService);
  protected mapLayerService = inject(MapLayerService);
  protected mapStateService = inject(MapStateService);
  
  readonly map = signal<MapLibreMap | undefined>(undefined);
  protected currentDrawCommand = signal<DrawCommand | undefined>(undefined);

  protected domainLayers = this.layerConfigService.data;
  readonly isAuthenticated = this.userService.state.isReady;


  constructor() {
    // select
    effect((onCleanup) => {
      const selected = this.mapStateService.selected();
      const map = this.map();
      if (!map) return;

      if (selected !== null) {
        map.setFeatureState(selected.featureId, {selected: true});
      }

      onCleanup(() => {
        if (selected !== null) {
          map.setFeatureState(selected.featureId, {selected: false});
        }
      });
    });

    // hover
    effect((onCleanup) => {
      const hovered = this.mapStateService.hovered();
      const map = this.map();
      if (!map) return;


      if (hovered.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
      } else {
        map.getCanvas().style.cursor = '';
      }

      hovered.forEach((s) => map.setFeatureState(s.featureId, {hover: true}));
      onCleanup(() => {
        hovered.forEach((s) => map.setFeatureState(s.featureId, {hover: false}));
      });
    });

    // hide
    effect((onCleanup) => {
      const hidden = this.mapStateService.hidden();
      const map = this.map();
      if (!map) return;

      hidden.forEach((s) => map.setFeatureState(s.featureId, {hide: true}));
      onCleanup(() => {
        hidden.forEach((s) => map.setFeatureState(s.featureId, {hide: false}));
      });
    });

    effect(() => this.handleModeChange())

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

  private handleModeChange() {
    const mode = this.mapStateService.mode();
    if (!this.map()) return;

    if (mode !== 'draw' && this.currentDrawCommand()) {
      this.exitDrawMode();
    }
  }



  onMapLoad(map: MapLibreMap) {
    // DEBUG tiles
    // map.showCollisionBoxes = true;
    // map.showTileBoundaries = true;

    this.map.set(map);
    this.destroyRef.onDestroy(() => this.map()?.remove());

    this.mapStateService.flyToCommand$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(command => {
        this.executeFlyTo(command);
      });

    this.registerDrawing(map)?.on('ready', () => {
      this.mapStateService.drawCommand$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(command => {
          this.enterDrawMode(command)
        })
    })
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

  private drawControl : MaplibreTerradrawControl | undefined;
  private draw : TerraDraw | undefined;
  private registerDrawing(map: MapLibreMap) {
    this.drawControl = new MaplibreTerradrawControl({
      modes: ['polygon', 'select', 'delete-selection', 'render'],
      open: true
    });
    map.addControl(this.drawControl, 'top-right');

    this.draw = this.drawControl.getTerraDrawInstance();
    if (!this.draw) {
      this.errorService.handleError(new Error('Failed to get terra draw instance'));
      return undefined;
    }
    this.hideDrawControl();

    // register layers for ordering
    this.draw.on('ready', () => {
      const layers = this.drawControl.cleanStyle(this.map().getStyle(), {onlyTerraDrawLayers: true}).layers.map(l => l.id);
      const groupId = "terradraw" as const;
      this.mapLayerService.addGroup({
        id: groupId,
        name: "TerraDraw",
        order: 100,
        visible: true,
        interactivity: {select: false, hover: false},
        category: "internal",
        thumbnailImg: "",
      });
      for (const lid of layers) {
        this.mapLayerService.addLayer({
          id: lid,
          groupId: groupId,
          layout: null,
          source: "",
          sourceLayer: "",
        });
      }
    })

    return this.draw;
  }
  private enterDrawMode(command: DrawCommand) : void {
    if (this.currentDrawCommand()) return;
    if (!this.map) return;

    this.currentDrawCommand.set(command);

    this.showDrawControl();


    if (command.id) {
      this.mapStateService.hide(command.id);
    }

    if (command.geometry) {
      const drawFeatureId = uuidv4();
      this.draw.addFeatures([{
        id: drawFeatureId, // has to be guid or silently dies
        type: 'Feature' as const,
        geometry: command.geometry,
        properties: {
          mode: command.mode
        }
      }]);
      this.draw.selectFeature(drawFeatureId);
    } else {
      this.draw.setMode(command.mode);
    }

    this.draw.on('finish', (id: any) => {
      const feature = this.draw.getSnapshotFeature(id);

      if (feature?.geometry) {
        this.mapStateService.drawResult$.next(feature.geometry);
        this.draw.setMode('select');
      }
    });
  }
  private exitDrawMode() {
    if (!this.currentDrawCommand()) return;
    if (!this.map) return;

    if (this.currentDrawCommand().id) {
      this.mapStateService.unhide(this.currentDrawCommand().id);
    }

    this.hideDrawControl()
    this.draw.clear();


    this.draw.setMode('render');
    this.currentDrawCommand.set(undefined);
  }


  // toggle css visibility - hack to work around terradraw control not initializing properly when added/removed after map loaded.
  private hideDrawControl() {
    if (!this.drawControl) return;
    const container = (this.drawControl as any).controlContainer;

    if (container) {
      container.style.display = 'none';
    }
  }

  private showDrawControl() {
    if (!this.drawControl) return;
    const container = (this.drawControl as any).controlContainer;
    if (container) {
      container.style.display = 'block';
    }
  }



  onEmptyClick(e: MapMouseEvent) {
    if (this.mapStateService.mode() !== 'select') return;
    if (e.defaultPrevented) return;

    const features = this.map().queryRenderedFeatures(e.point);
    if (features && features.length > 0) {
      const hasInteractiveFeature = features.some(feature => {
        const group = this.mapLayerService.getGroupBySource(feature.source, feature.sourceLayer);
         return group?.interactivity?.select === true;
      });
      if (hasInteractiveFeature) return;
    }
    this.mapStateService.clearSelection();
  }


  private executeFlyTo(command: FlyToCommand): void {
    if (!this.map()) return;
    if (!command.geometry) return;

    const camera = this.getCameraWithPadding(command.geometry);

    const easeParametric = (t: number) => {
      const sqr = t * t;
      return sqr / (2 * (sqr - t) + 1);
    }

    this.map().flyTo({
      ...camera,
      speed: 3,
      maxDuration: 1500,
      curve: 1.42,
      easing: easeParametric
    })
  }

  private getCameraWithPadding(geometry: Geometry, padFraction: number = 0.1) {
    const mapContainer = this.map().getContainer();
    const mapPadding = this.mapStateService.padding()

    const bounds = boundingBox(geometry);

    return this.map().cameraForBounds(bounds, {
      padding: {
        top: mapPadding.top + mapContainer.offsetHeight * padFraction,
        bottom: mapPadding.bottom + mapContainer.offsetHeight * padFraction,
        left: mapPadding.left + mapContainer.offsetWidth * padFraction,
        right: mapPadding.right + mapContainer.offsetWidth * padFraction,
      },
    })
  }
}