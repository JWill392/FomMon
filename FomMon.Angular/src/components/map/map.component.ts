import {
  ChangeDetectionStrategy,
  Component,
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
import {LayerKind} from "../layer-type/layer-type.model";
import Sidebar from "./sidebar/sidebar";
import {RouterOutlet} from "@angular/router";
import {UserMenu} from "../user/user-menu/user-menu";
import {MapSelection, MapStateService} from "./map-state.service";
import {ErrorService} from "../shared/error.service";
import {MapLayerGroupComponent} from "./layer/map-layer-group/map-layer-group.component";
import {fidEquals} from "./map-util";


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

  protected domainLayers = this.layerConfigService.data;
  readonly isAuthenticated = this.userService.state.isReady;


  constructor() {
    let previousSelection : MapSelection | null = null;
    effect(() => previousSelection = this.handleSelectionChange(previousSelection));

    let previousHover : Set<MapSelection> = new Set();
    effect(() => previousHover = this.handleHoverChange(previousHover));

    effect(() => this.handleModeChange())

    let alertedFeatures = new Map<LayerKind, Set<number>>();
    effect(() => alertedFeatures = this.handleLayerAlertChange(alertedFeatures));
  }


  private handleSelectionChange(previousSelection: MapSelection) {
    const selected = this.mapStateService.selected();
    if (!this.map()) return previousSelection;
    if (fidEquals(previousSelection?.featureId, selected?.featureId)) return previousSelection;

    if (selected !== null)
      this.map().setFeatureState(selected.featureId, {selected: true});

    if (previousSelection)
      this.map().setFeatureState(previousSelection.featureId, {selected: false});

    return selected;
  }

  private handleHoverChange(previousHover: Set<MapSelection>) {
    const newHover = new Set(this.mapStateService.hovered()); // reference equality is good enough
    const map = this.map();
    if (!map) return previousHover;


    previousHover.difference(newHover).forEach((s) => map.setFeatureState(s.featureId, {hover: false}))
    newHover.difference(previousHover).forEach((s) => map.setFeatureState(s.featureId, {hover: true}))

    if (newHover.size > 0 && previousHover.size === 0) {
      this.mapStateService.map().getCanvas().style.cursor = 'pointer';
    } else if (newHover.size === 0 && previousHover.size > 0) {
      this.mapStateService.map().getCanvas().style.cursor = '';
    }

    return newHover;
  }
  private handleLayerAlertChange(alertedFeatures: Map<LayerKind, Set<number>>) {
    const layerList = this.layerConfigService.data();
    const layerAlertMap = this.alertService.byLayer();
    const map = this.map();

    if (!map || !layerList || !layerAlertMap) return alertedFeatures;

    for (const layer of layerList) {
      const kind = layer.kind;

      if (!alertedFeatures.has(kind)) {
        alertedFeatures.set(kind, new Set())
      }
      const oldAlerts = alertedFeatures.get(kind)!;

      const newAlerts = new Set((layerAlertMap.get(kind) ?? []).map((a) => a.featureReference.sourceFeatureId) ?? []);

      const getId = (id: number) => ({
        source: kind,
        sourceLayer: layer.tileSource,
        id: id,
      });

      oldAlerts.difference(newAlerts).forEach((id) => map.setFeatureState(getId(id), {alert: false}))
      newAlerts.difference(oldAlerts).forEach((id) => map.setFeatureState(getId(id), {alert: true}))
      alertedFeatures.set(kind, newAlerts);
    }

    return alertedFeatures;
  }


  private handleModeChange() {
    const mode = this.mapStateService.mode();
    if (!this.map()) return;

    if (mode === 'draw') {
      this.enterDrawMode();

    } else {
      this.exitDrawMode();
    }
  }


  onMapLoad(map: MapLibreMap) {
    // DEBUG tiles
    // map.showCollisionBoxes = true;
    // map.showTileBoundaries = true;

    this.registerDrawing(map);
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

}