import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
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
import {FeatureIdentifier, Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent} from 'maplibre-gl';
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
import {LayerKind} from "../layer-type/layer-type.model";
import Sidebar from "./sidebar/sidebar";
import {RouterOutlet} from "@angular/router";
import {UserMenu} from "../user/user-menu/user-menu";
import {MapSelection, MapStateService} from "./map-state.service";
import {ErrorService} from "../shared/error.service";
import {MapLayerGroupComponent} from "./layer/map-layer-group/map-layer-group.component";


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
    RouterOutlet,
    UserMenu,
    MapLayerGroupComponent,
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapComponent {
  private layerConfigService = inject(LayerConfigService);
  private userService = inject(UserService);
  private alertService = inject(AreaAlertService);
  private errorService = inject(ErrorService);
  protected mapLayerService = inject(MapLayerService);
  protected mapStateService = inject(MapStateService);

  defaultCenter = input<[number, number]>([-120.5, 50.6]);
  defaultZoom = input<[number]>([7]);

  readonly map = signal<MapLibreMap | undefined>(undefined);
  protected isDrawMode = signal(false);
  private readonly alertedFeatures = new Map<LayerKind, Set<number>>();

  protected domainLayers = this.layerConfigService.data;
  readonly isAuthenticated = this.userService.state.isReady;


  constructor() {
    // selection
    let previousSelection : MapSelection | null = null;
    effect(() => {
      var selected = this.mapStateService.selected();
      if (!this.map()) return;

      if (selected !== null) {
        this.map().setFeatureState(selected.featureId, { selected: true });
      }

      if (previousSelection) {
        // toggle
        if (this.identifierEquals(previousSelection?.featureId, selected?.featureId)) {
          this.mapStateService.clearSelection();
        } else {
          this.map().setFeatureState(previousSelection.featureId, { selected: false });
        }
      }



      previousSelection = selected;
    });

    // hover
    let previousHover : Set<MapSelection> = new Set();
    effect(() => {
      const newHover = new Set(this.mapStateService.hovered()); // reference equality is good enough
      const map = this.map();
      if (!map) return;


      previousHover.difference(newHover).forEach((s) => map.setFeatureState(s.featureId, { hover: false }))
      newHover.difference(previousHover).forEach((s) => map.setFeatureState(s.featureId, { hover: true }))

      if (newHover.size > 0 && previousHover.size === 0) {
        this.mapStateService.map().getCanvas().style.cursor = 'pointer';
      } else if (newHover.size === 0 && previousHover.size > 0) {
        this.mapStateService.map().getCanvas().style.cursor = '';
      }

      previousHover = newHover;
    });

    // draw mode
    effect(() => {
      const mode = this.mapStateService.mode();
      if (!this.map()) return;

      if (mode === 'draw') {
        this.enterDrawMode();

      } else {
        this.exitDrawMode();
      }
    })

    // alert status
    effect(() => {
      const layerList = this.layerConfigService.data();
      const layerAlertMap = this.alertService.byLayer();
      const map = this.map();

      if (!map || !layerList || !layerAlertMap) return;

      for (const layer of layerList) {
        const kind = layer.kind;

        if (!this.alertedFeatures.has(kind)) {this.alertedFeatures.set(kind, new Set())}
        const oldAlerts = this.alertedFeatures.get(kind)!;

        const newAlerts = new Set((layerAlertMap.get(kind) ?? []).map((a) => a.featureReference.sourceFeatureId) ?? []);

        const getId = (id: number) => ({
          source: kind,
          sourceLayer: layer.tileSource,
          id: id,
        });

        oldAlerts.difference(newAlerts).forEach((id) => map.setFeatureState(getId(id), { alert: false }))
        newAlerts.difference(oldAlerts).forEach((id) => map.setFeatureState(getId(id), { alert: true }))
        this.alertedFeatures.set(kind, newAlerts);

        map.triggerRepaint();
      }
    });
  }

  onMapLoad(map: MapLibreMap) {
    // DEBUG tiles
    // map.showCollisionBoxes = true;
    // map.showTileBoundaries = true;

    this.registerDrawing(map);
    this.registerInteractivity(map);
    this.map.set(map);
    this.mapStateService.initializeMap(map);
    this.mapStateService.startSelectMode();
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
      modes: ['polygon', 'select', 'delete-selection'],
      open: true
    });
    map.addControl(this.drawControl, 'top-right');

    this.draw = this.drawControl.getTerraDrawInstance();
    if (!this.draw) {
      this.errorService.handleError(new Error('Failed to get terra draw instance'));
      return;
    }
    this.hideDrawControl();
  }
  private enterDrawMode() : void {
    if (this.isDrawMode()) return;
    if (!this.map) return;

    this.isDrawMode.set(true);

    this.showDrawControl();
    this.draw.setMode('polygon');

    this.draw.on('finish', (id: any) => {
      const feature = this.draw.getSnapshotFeature(id);

      if (feature?.geometry) {
        this.mapStateService.drawResult$.next(feature.geometry);
      }
    });

    // this.drawControl.activate();
  }
  private exitDrawMode() {
    if (!this.isDrawMode()) return;
    if (!this.map) return;

    this.hideDrawControl()
    this.draw.clear();


    this.draw.setMode('select');
    this.isDrawMode.set(false);
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


  // TODO migrate to angular
  private registerInteractivity(map: MapLibreMap) {

    // Deselect on empty click
    map.on('click', async (e) => {
      if (this.mapStateService.mode() !== 'select') return;
      if (e.defaultPrevented) return;
      this.mapStateService.clearSelection();
    });

  }

  private getIdentifier(f: MapGeoJSONFeature): FeatureIdentifier {
    return {
      source: f.source,
      sourceLayer: f.sourceLayer,
      id: f.id,
    };
  }

  private identifierEquals(a: FeatureIdentifier | null, b: FeatureIdentifier | null) {
    if (!a || !b) return false;
    return a.source === b.source && a.sourceLayer === b.sourceLayer && a.id === b.id;
  }
}