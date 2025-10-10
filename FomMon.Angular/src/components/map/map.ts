import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Input, Signal,
  signal,
  ViewChild, WritableSignal,
} from '@angular/core';
import {
  FeatureIdentifier,
  GeoJSONSource,
  GeolocateControl,
  Map,
  MapGeoJSONFeature,
  NavigationControl,
  ScaleControl,
  StyleLayer
} from 'maplibre-gl';
import {ProjectFactory, Projects} from '../../types/project';
import {HttpClient} from '@angular/common/http';
import {MaplibreTerradrawControl} from '@watergis/maplibre-gl-terradraw';
import {addProjectClusterLayer, AddUpdateProjectSource} from './project-layer.service';
import {addProjectFeatureLayers} from './project-feature-layer.service';
import {addAreaWatchLayer, AddUpdateAreaWatchSource} from './area-watch-layer.service';
import {map} from "rxjs/operators";
import {AreaWatchService} from '../area-watch/area-watch.service';
import {AreaWatchList} from '../area-watch/area-watch-list/area-watch-list';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {UserService} from '../user/user.service';
import {LayerKind} from '../layer/layer.model';
import {LayerService} from '../layer/layer.service';
import {AreaAlertService} from "../area-alert/area-alert.service";

interface LayerGroup {
  id: string;
  name: string;
  thumbnailImg: string;
  visible: boolean;

  add: StyleLayerFactory;
  layers: StyleLayer[];
}
type StyleLayerFactory = (map: Map) => StyleLayer[];


@Component({
  selector: 'app-map',
  imports: [
    AreaWatchList
  ],//MapDrawerComponent],
  templateUrl: './map.html',
  styleUrl: './map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements AfterViewInit {
  @ViewChild('map', {static:true}) mapElement!: ElementRef<HTMLDivElement>;
  projects = signal<Projects>([]);

  @Input() defaultCenter: [number, number] = [-120.5, 50.6];
  @Input() defaultZoom: number = 7;

  map!: Map;
  private mapState = signal<'idle' | 'ready' | 'loaded'>('idle');


  private areaWatchService = inject(AreaWatchService);
  private areaAlertService = inject(AreaAlertService);
  private layerService = inject(LayerService);
  private destroyRef = inject(DestroyRef);
  private userService = inject(UserService);

  isAuthenticated = this.userService.state.isReady;

  //selectedItem = signal<any>(null);

  protected baseLayers : LayerGroup[] = [{
    id: 'osm',
    name: 'Map',
    thumbnailImg: 'assets/layer-preview-osm.png',
    visible: true,
    add: (map : Map) => {
      const sourceId = 'osm'
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      });

      const layerId = 'osm-base';
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        minzoom: 0,
        maxzoom: 19,
      })

      return [map.getLayer(layerId)!];
    },
    layers: []
  },

    {
      id: 'esri-imagery',
      name: 'Imagery',
      thumbnailImg: 'assets/layer-preview-esri-imagery.png',
      visible: false,
      add: (map : Map) => {
        const sourceId = 'esri-world-imagery'
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution:
              'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
        });

        const layerId = 'esri-imagery';
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          minzoom: 0,
          maxzoom: 19,
          layout: { visibility: 'none' }
        })

        return [map.getLayer(layerId)!];
      },
      layers: []
    }];


  constructor(private http: HttpClient) {

    effect(() => {
      const mapReady = this.mapState() === "ready";
      const configReady = this.layerService.state.isReady();
      if (!mapReady || !configReady) return;

      this.registerMapControls();


      this.addBaseLayers();
      this.addDomainLayers();
      this.registerInteractivity();
      this.mapState.set("loaded");

      this.registerDrawing();
    });

    // areawatch data updates after load
    effect(() => {
      const mapLoaded = this.mapState() === 'loaded';
      const awReady = this.areaWatchService.state.isReady();
      const awData = this.areaWatchService.data(); // Track data changes

      if (!mapLoaded || !awReady) return;

      AddUpdateAreaWatchSource(awData, this.map, 'area-watches');
    });

    // project data updates after load
    effect(() => {
      const mapLoaded = this.mapState() === 'loaded';
      const proj = this.projects()
      if (!mapLoaded) return; // TODO make service for projects; wait for state

      AddUpdateProjectSource(proj, this.map, 'projects');
    });

    // set alert featurestate
    effect(() => {
      const mapLoaded = this.mapState() === 'loaded';
      const configReady = this.layerService.state.isReady();
      const alertReady = this.areaAlertService.state.isReady();
      const alertLayers = this.areaAlertService.byLayer();

      if (!mapLoaded || !alertReady || !configReady) return;

      // TODO set featurestate alert from alertservice
      for (const [layerKind, alerts] of alertLayers) {
        const layer = this.layerService.byKind()[layerKind]
        for (const alert of alerts) {
          const featureId = {
            source: layerKind,
            sourceLayer: layer.tileSource,
            id: alert.featureReference.sourceFeatureId,
          }
          this.map.setFeatureState(featureId, { alert: true });
        }
      }
      // TODO unset featurestate alert when removed from alertservice
    })

    http.get<any[]>('api/projects').pipe( // TODO move projects to service
        map(body => body.map(ProjectFactory.fromJson))
    ).subscribe({
      next: result => this.projects.set(result),
      error: console.error
    });

  }

  ngAfterViewInit() {
    this.initMap();

    /* MAP LOAD */
    this.map.on('load', () => this.mapState.set("ready"));
  }

  private initMap() {
    this.map = new Map({
      container: this.mapElement.nativeElement,
      style: 'https://demotiles.maplibre.org/style.json', //TODO style
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      hash: true, // sync view with URL hash

      // Problem: MapLibre disallows relative URLs, but they are required for proxy (angular in dev, docker-nginx in prod)
      // Workaround: use local://. prefix in MapLibre config and rewrite with transformRequest
      // Usage: use tile/sprite/glyph URLs like "local://./tileserver/project_features.1/{z}/{x}/{y}"
      transformRequest: (url) => {
        if (/^local:\/\//.test(url)) {
          // If url starts with local://, resolve it relative to the current page
          return { url: new URL(url.substr('local://'.length), location.href).href };
        }
        return undefined;
      },
    });

  }

  private registerMapControls() {
    this.map.addControl(new NavigationControl({showCompass:false}), 'top-right'); // zoom and rotation
    this.map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
    this.map.addControl(
      new GeolocateControl({
        positionOptions: {
          enableHighAccuracy: false
        },
        trackUserLocation: true
      })
    );
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
  }

  private registerDrawing() {
    const drawControl = new MaplibreTerradrawControl({
      modes: ['polygon', 'select', 'delete-selection', 'render'],
      open: true
    });
    this.map.addControl(drawControl)

    const draw = drawControl.getTerraDrawInstance();
    if (!draw) {
      console.error('Failed to get terra draw instance');
      return; // TODO can this fail?
    }


    draw.on('finish', (id: any) => {
      // TODO change flow.  currently saves immediately. instead allow tweaking shape before explicit save?
      const feature = draw.getSnapshotFeature(id);

      const addAw = this.areaWatchService.createId({
        geometry: feature?.geometry,
        name: 'New Area Watch', // TODO set meaningful name
        layers: ["FomCutblock" as LayerKind, "FomRoad" as LayerKind] // TODO populate commalist from active layers
      });
      draw.removeFeatures([id]); // remove draw copy

      this.areaWatchService.add$(addAw)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe()


      draw.setMode('select');
    });

    // TODO change existing geoms
    draw.on('change', (e: any) => {
      //console.log('draw.change', e);
    });

  }

  private addBaseLayers() {
    for (const base of this.baseLayers) {
      base.layers = base.add(this.map);
    }
  }
  protected selectBaseLayerGroup(id: string) {
    for (const layerGroup of this.baseLayers) {
      layerGroup.visible = layerGroup.id === id;
      for (const layer of layerGroup.layers) {
        layer.setLayoutProperty('visibility', layerGroup.visible ? 'visible' : 'none');
      }

      const zoom = this.map.getZoom();
      this.map.setZoom(zoom+0.1);
      this.map.setZoom(zoom); // force reload.. not sure why this is necessary
    }
  }


  private addDomainLayers() {
    for (const lay of this.layerService.data()) {
      addProjectFeatureLayers({
        map: this.map,
        url: `local://./tileserver/${lay.tileSource}/{z}/{x}/{y}`,
        sourceId: lay.kind,
        sourceLayer: lay.tileSource,
        featureFillLayer: `${lay.tileSource}`,
        featureLineLayer: `${lay.tileSource}-lines`,
        layerColor: lay.color,
      });
    }

    addProjectClusterLayer({
      map: this.map,
      projects: this.projects(),
      sourceId: 'projects',
      clusterLayerId: 'project-clusters',
    });

    addAreaWatchLayer({
      map: this.map,
      areaWatches: this.areaWatchService.data(),
      sourceId: 'area-watches',
      layerId: 'area-watch',
      nameLayerId: 'area-watch-name',
    })
  }

  private registerInteractivity() {
    interface LayerInteractivity {
      id: string;
      selectable?: boolean;
      hoverable?: boolean;
      clickable?: boolean;
      clusterZoom?: boolean;
    }

    const LAYER_INTERACTIVITY: LayerInteractivity[] = [
      { id: 'project-points', selectable: true, hoverable: true, clickable: true},
      { id: 'fom_cutblock', selectable: true, hoverable: true, clickable: true }, // TODO new layer names; but ngMap does this differently anyways
      // { id: 'project-feature-lines', selectable: true, hoverable: true, clickable: true},
      { id: 'project-clusters', hoverable: true, clickable: true, clusterZoom: true },
      { id: 'area-watch', selectable: true, hoverable: true, clickable: true }
    ];
    const getLayerIdsBy = (key: keyof LayerInteractivity): string[] =>
      LAYER_INTERACTIVITY.filter(layer => layer[key]).map(layer => layer.id);


    // highlight a project on click
    let selectedFeatureId : FeatureIdentifier | null = null;
    this.map.on('click', getLayerIdsBy('selectable'),
      async (e) => {
        let priorSelected = selectedFeatureId;

        if (e.features && e.features.length > 0) {
          selectedFeatureId = this.getIdentifier(e.features[0]);
          this.map.setFeatureState(selectedFeatureId, { selected: true });
        } else {
          selectedFeatureId = null;
        }

        if (priorSelected) { // toggle selection if same
          this.map.setFeatureState(priorSelected, { selected: false });
          if (this.identifierEquals(priorSelected, selectedFeatureId)) {
            selectedFeatureId = null;
          }
        }

        e.preventDefault();

        //this.mapDrawer.openDrawer(e.features[0].properties);
      });

    // deselect on empty click
    this.map.on('click', async (e) => {
      if (e.defaultPrevented) return;
      if (selectedFeatureId) {
        this.map.setFeatureState(selectedFeatureId, { selected: false });
        selectedFeatureId = null;
      }
    });


    // inspect a cluster on click
    this.map.on('click', getLayerIdsBy('clusterZoom'),
      async (e) => {
      if (e.defaultPrevented) return;

      const features = this.map.queryRenderedFeatures(e.point, {
        layers: getLayerIdsBy('clusterZoom')
      });
      const f = features[0];
      const clusterId = f.properties['cluster_id'];

      const source = this.map.getSource(f.source as string) as GeoJSONSource;

        // TODO improve cluster zoom; currently zooms to minimum to remove 1 point from cluster. should zoom to decluster all
      const zoom = await source.getClusterExpansionZoom(clusterId);

      const geometry = f.geometry as { type: string; coordinates: [number, number] };

      this.map.easeTo({
        center: geometry.coordinates,
        zoom
      });
    });


    // cursor on clickable layer
    this.map.on('mouseenter', getLayerIdsBy('clickable'), () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', getLayerIdsBy('clickable'), () => {
      this.map.getCanvas().style.cursor = '';
    });

    // hover feature-state set/remove
    getLayerIdsBy('hoverable').forEach(layerId => {
      // separate hover state for each layer to avoid flicker
      let hoveredFeatureId : FeatureIdentifier | null = null;
      this.map.on('mousemove', layerId, (e: any) => {
        //console.log('hover', e.features);
        if (e.features && e.features.length > 0) {
          if (hoveredFeatureId) {
            this.map.setFeatureState(hoveredFeatureId, { hover: false });
          }
          hoveredFeatureId = this.getIdentifier(e.features[0]);
          this.map.setFeatureState(hoveredFeatureId, { hover: true });
        }
      });

      this.map.on('mouseleave', layerId, () => {
        if (hoveredFeatureId) {
          this.map.setFeatureState(hoveredFeatureId, { hover: false });
        }
        hoveredFeatureId = null;
      });
    });
  }

  private getIdentifier(f : MapGeoJSONFeature) : FeatureIdentifier {
    return {
      source: f.source,
      sourceLayer: f.sourceLayer,
      id: f.id,
    };
  }
  private identifierEquals(a : FeatureIdentifier | null, b: FeatureIdentifier | null) {
    if (!a || !b) return false;
    return a.source === b.source && a.sourceLayer === b.sourceLayer && a.id === b.id;
  }

}
