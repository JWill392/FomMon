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
import {LayerKind} from "../layer-type/layer-type.model";
import {UserMenu} from "../user/user-menu/user-menu";
import {DrawCommand, FlyToCommand, MapSelection, MapStateService} from "./map-state.service";
import {ErrorService} from "../shared/error.service";
import {MapLayerGroupComponent} from "./layer/map-layer-group/map-layer-group.component";
import {boundingBox, fidEquals} from "./map-util";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Sidebar} from "./sidebar/sidebar";
import {AppConfigService} from "../../config/app-config.service";
import {v4 as uuidv4} from 'uuid';

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
    let previousSelection : MapSelection | null = null;
    effect(() => previousSelection = this.handleSelectionChange(previousSelection));

    let previousHover : Set<MapSelection> = new Set();
    effect(() => previousHover = this.handleHoverChange(previousHover));

    let hiddenFeatures = new Set<MapSelection>();
    effect(() => hiddenFeatures = this.handleHiddenChange(hiddenFeatures));

    effect(() => this.handleModeChange())

    let alertedFeatures = new Map<LayerKind, Set<number>>();
    effect(() => alertedFeatures = this.handleLayerAlertChange(alertedFeatures));


    // optional: update map vanishing point on sidebar open/close.  maybe a bit much
    // effect(() => {
    //   const paddingChange = this.mapStateService.paddingChange();
    //   const map = this.map();
    //
    //   if (!map) return;
    //   map.easeTo({...paddingChange, })
    // })
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


    let removed = previousHover.difference(newHover);
    removed.forEach((s) => map.setFeatureState(s.featureId, {hover: false}))

    let added = newHover.difference(previousHover);
    added.forEach((s) => map.setFeatureState(s.featureId, {hover: true}))

    if (newHover.size > 0) {
      map.getCanvas().style.cursor = 'pointer';
    } else if (newHover.size === 0) {
      map.getCanvas().style.cursor = '';
    }

    return newHover;
  }


  private handleHiddenChange(previousHidden: Set<MapSelection>) {
    const newHidden = new Set(this.mapStateService.hidden()); // reference equality is good enough
    const map = this.map();
    if (!map) return previousHidden;

    let removed = previousHidden.difference(newHidden);
    removed.forEach((s) => map.setFeatureState(s.featureId, {hide: false}))

    let added = newHidden.difference(previousHidden);
    added.forEach((s) => map.setFeatureState(s.featureId, {hide: true}))

    return newHidden;
  }
  
  private handleLayerAlertChange(alertedFeatures: Map<LayerKind, Set<number>>) {
    const layerList = this.layerConfigService.data();
    const layerAlertMap = this.areaAlertService.byLayer();
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

    if (mode !== 'draw' && this.currentDrawCommand()) {
      this.exitDrawMode();
    }
  }



  onMapLoad(map: MapLibreMap) {
    // DEBUG tiles
    // map.showCollisionBoxes = true;
    // map.showTileBoundaries = true;

    this.registerDrawing(map);
    this.map.set(map);
    this.destroyRef.onDestroy(() => this.map()?.remove());

    this.mapStateService.flyToCommand$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(command => {
        // wait for sidebar to open for padding calculation
        const timer = setTimeout(() => this.executeFlyTo(command));
        this.destroyRef.onDestroy(() => clearTimeout(timer));
      });

    this.mapStateService.drawCommand$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(command => {
        this.enterDrawMode(command)
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
      return;
    }
    this.hideDrawControl();
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

    const mapContainer = this.map().getContainer();
    const cameraPadding = {height: mapContainer.offsetHeight / 10, width: mapContainer.offsetWidth / 10};
    const bounds = boundingBox(command.geometry);

    const camera = this.map().cameraForBounds(bounds, {
      padding: {top: cameraPadding.height, bottom: cameraPadding.height, left: cameraPadding.width, right: cameraPadding.width},
    })

    const easeParametric = (t: number) => {
      const sqr = t * t;
      return sqr / (2 * (sqr - t) + 1);
    }

    this.map().flyTo({
      ...camera,
      speed: 3,
      maxDuration: 1500,

      curve: 1.42,
      padding: this.mapStateService.padding().padding,
      easing: easeParametric
    })
  }
}