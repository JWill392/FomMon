import {ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal,} from '@angular/core';
import {
  AttributionControlDirective,
  ControlComponent,
  LayerComponent,
  MapComponent as MglMapComponent,
  NavigationControlDirective,
  RasterSourceComponent,
  ScaleControlDirective,
} from '@maplibre/ngx-maplibre-gl';
import type {FeatureIdentifier, Map as MapLibreMap, MapGeoJSONFeature} from 'maplibre-gl';
import {HttpClient} from '@angular/common/http';
import {MaplibreTerradrawControl} from '@watergis/maplibre-gl-terradraw';
import {AreaWatchService} from '../area-watch/area-watch.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {UserService} from '../user/user.service';
import {LayerTypeService} from '../layer-type/layer-type.service';
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
    AttributionControlDirective,
  ],
  templateUrl: './ngx-map.html',
  styleUrl: './ngx-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxMap {
  defaultCenter = input<[number, number]>([-120.5, 50.6]);
  defaultZoom = input<[number]>([7]);

  readonly map = signal<MapLibreMap | undefined>(undefined);

  private layerService = inject(LayerTypeService);
  private userService = inject(UserService);
  private areaWatchService = inject(AreaWatchService);
  private areaAlertService = inject(AreaAlertService);
  private destroyRef = inject(DestroyRef);

  readonly isAuthenticated = this.userService.state.isReady;

  protected domainLayers = this.layerService.data;

  protected mapLayerService = inject(MapLayerService);



  private readonly alertedFeatures = new Map<LayerKind, Set<string>>();
  constructor(private http: HttpClient) {

    // Set alert feature states
    effect(() => {
      const layerList = this.layerService.data();
      const layerAlertMap = this.areaAlertService.byLayer();
      const map = this.map();

      if (!map || !layerList || !layerAlertMap) return;

      for (const layer of layerList) {
        const kind = layer.kind;

        if (!this.alertedFeatures.has(kind)) {this.alertedFeatures.set(kind, new Set())}
        const oldAlerts = this.alertedFeatures.get(kind)!;

        const newAlerts = new Set((layerAlertMap.get(kind) ?? []).map((a) => a.featureReference.sourceFeatureId) ?? []);

        const getId = (id: string) => ({
          source: kind,
          sourceLayer: layer.tileSource,
          id: id,
        });

        oldAlerts.difference(newAlerts).forEach((id) => this.map().setFeatureState(getId(id), { alert: false }))
        newAlerts.difference(oldAlerts).forEach((id) => this.map().setFeatureState(getId(id), { alert: true }))
        this.alertedFeatures.set(kind, newAlerts);
      }
    });
  }

  onMapLoad(map: MapLibreMap) {
    this.map.set(map);

    this.registerDrawing();
    this.registerInteractivity();
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


  // TODO refactor to a signal to enter 'drawing mode' with drawFinish callback.  perhaps rxJs.
  private registerDrawing() {
    if (!this.map) return;

    const drawControl = new MaplibreTerradrawControl({
      modes: ['polygon', 'select', 'delete-selection', 'render'],
      open: true,
    });
    this.map().addControl(drawControl);

    const draw = drawControl.getTerraDrawInstance();
    if (!draw) {
      console.error('Failed to get terra draw instance');
      return;
    }

    draw.on('finish', (id: any) => {
      const feature = draw.getSnapshotFeature(id);

      const addAw = this.areaWatchService.createId({
        geometry: feature?.geometry,
        name: 'New Area Watch',
        layers: ['FomCutblock' as LayerKind, 'FomRoad' as LayerKind],
      });
      draw.removeFeatures([id]);

      this.areaWatchService
        .add$(addAw)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();

      draw.setMode('select');
    });

    draw.on('change', (e: any) => {
      // TODO handle changes
    });
  }

  // TODO use NGX hover
  private registerInteractivity() {
    if (!this.map) return;

    interface LayerInteractivity {
      id: string;
      selectable?: boolean;
      hoverable?: boolean;
      clickable?: boolean;
      clusterZoom?: boolean;
    }

    const LAYER_INTERACTIVITY: LayerInteractivity[] = [
      { id: 'fom_cutblock', selectable: true, hoverable: true, clickable: true },
      { id: 'area-watch', selectable: true, hoverable: true, clickable: true },
    ];

    const getLayerIdsBy = (key: keyof LayerInteractivity): string[] =>
      LAYER_INTERACTIVITY.filter((layer) => layer[key]).map((layer) => layer.id);

    let selectedFeatureId: FeatureIdentifier | null = null;

    // Selection on click
    this.map().on('click', getLayerIdsBy('selectable'), async (e) => {
      if (!this.map) return;
      const priorSelected = selectedFeatureId;

      if (e.features && e.features.length > 0) {
        selectedFeatureId = this.getIdentifier(e.features[0]);
        this.map().setFeatureState(selectedFeatureId, { selected: true });
      } else {
        selectedFeatureId = null;
      }

      if (priorSelected) {
        this.map().setFeatureState(priorSelected, { selected: false });
        if (this.identifierEquals(priorSelected, selectedFeatureId)) {
          selectedFeatureId = null;
        }
      }

      e.preventDefault();
    });

    // Deselect on empty click
    this.map().on('click', async (e) => {
      if (!this.map || e.defaultPrevented) return;
      if (selectedFeatureId) {
        this.map().setFeatureState(selectedFeatureId, { selected: false });
        selectedFeatureId = null;
      }
    });


    // Cursor changes
    this.map().on('mouseenter', getLayerIdsBy('clickable'), () => {
      if (this.map) this.map().getCanvas().style.cursor = 'pointer';
    });
    this.map().on('mouseleave', getLayerIdsBy('clickable'), () => {
      if (this.map) this.map().getCanvas().style.cursor = '';
    });

    // Hover states
    getLayerIdsBy('hoverable').forEach((layerId) => {
      let hoveredFeatureId: FeatureIdentifier | null = null;
      this.map().on('mousemove', layerId, (e: any) => {
        if (!this.map) return;
        if (e.features && e.features.length > 0) {
          if (hoveredFeatureId) {
            this.map().setFeatureState(hoveredFeatureId, { hover: false });
          }
          hoveredFeatureId = this.getIdentifier(e.features[0]);
          this.map().setFeatureState(hoveredFeatureId, { hover: true });
        }
      });

      this.map().on('mouseleave', layerId, () => {
        if (!this.map || !hoveredFeatureId) return;
        this.map().setFeatureState(hoveredFeatureId, { hover: false });
        hoveredFeatureId = null;
      });
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

  protected readonly Object = Object;
}