import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output,} from '@angular/core';
import type {EventData} from '@maplibre/ngx-maplibre-gl';
import {LayerComponent,} from '@maplibre/ngx-maplibre-gl';
import {
  FeatureIdentifier,
  FilterSpecification,
  LayerSpecification,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  MapLayerTouchEvent,
  MapMouseEvent,
} from 'maplibre-gl';
import {LayerInteractivity, MapLayerService} from "../map-layer.service";
import {MapStateService} from "../../map-state.service";
import {MapFeatureService} from "../../../feature/map-feature.service";

/**
 * Wrapper component for mgl-layer that registers with MapLayerService
 * for managing visibility and interactivity.
 * Automatically manages the layout property.
 */
@Component({
  selector: 'app-layer',
  standalone: true,
  imports: [LayerComponent],
  templateUrl: './map-layer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapLayerComponent {
  protected mapLayerService = inject(MapLayerService);
  private mapStateService = inject(MapStateService);
  private mapFeatureService = inject(MapFeatureService);
  private destroyRef = inject(DestroyRef);

  groupId = input.required<string>();

  interactivity = input<LayerInteractivity | undefined>();

  protected serviceLayout = computed(() => this.mapLayerService.getLayout(this.id()));

  /** LayerComponent inputs **/
  // Required inputs
  readonly id = input.required<LayerSpecification['id']>();
  readonly type = input.required<LayerSpecification['type']>();

  // Optional inputs
  readonly source = input.required<string>();
  readonly metadata = input<LayerSpecification['metadata']>();
  readonly sourceLayer = input<string>();
  readonly filter = input<FilterSpecification>();
  readonly layoutInput = input<LayerSpecification['layout']>({}, {alias: 'layout'});
  readonly paintInput = input<LayerSpecification['paint']>({}, {alias: 'paint'});

  readonly before = input<string>();
  readonly minzoom = input<LayerSpecification['minzoom']>();
  readonly maxzoom = input<LayerSpecification['maxzoom']>();

  // Events
  readonly layerClick = output<MapLayerMouseEvent & EventData>();
  readonly layerDblClick = output<MapLayerMouseEvent & EventData>();
  readonly layerMouseDown = output<MapLayerMouseEvent & EventData>();
  readonly layerMouseUp = output<MapLayerMouseEvent & EventData>();
  readonly layerMouseEnter = output<MapLayerMouseEvent & EventData>();
  readonly layerMouseLeave = output<MapLayerMouseEvent & EventData>();
  readonly layerMouseMove = output<MapLayerMouseEvent & EventData>();
  readonly layerMouseOver = output<MapLayerMouseEvent & EventData>();
  readonly layerMouseOut = output<MapLayerMouseEvent & EventData>();
  readonly layerContextMenu = output<MapLayerMouseEvent & EventData>();
  readonly layerTouchStart = output<MapLayerTouchEvent & EventData>();
  readonly layerTouchEnd = output<MapLayerTouchEvent & EventData>();
  readonly layerTouchCancel = output<MapLayerTouchEvent & EventData>();


  protected paintLoose = computed<any>(() => this.paintInput()); // workaround ngx-maplibre outdated maplibre types

  ngOnInit(): void {
    this.mapLayerService.addLayer({
      id: this.id(),
      groupId: this.groupId(),
      layout: this.layoutInput(),
      source: this.source(),
      sourceLayer: this.sourceLayer(),
      interactivity: this.interactivity(),
    });
  }

  ngOnDestroy(): void {
    this.mapLayerService.removeLayer(this.id());
  }

  constructor() {
  }

  onClick(e: MapMouseEvent & {features?: MapGeoJSONFeature[]} & EventData) {
    this.selectAndCacheOnFeatureClick(e);
  }

  private selectAndCacheOnFeatureClick(e: MapMouseEvent & { features?: MapGeoJSONFeature[] } & EventData) {
    if (!this.interactivity()?.select) return;
    if (this.mapStateService.mode() !== 'select') return;
    if (!e.features?.length) {
      return;
    }

    const feature = e.features[0];
    const id = this.getIdentifier(feature);

    const isSelected = this.mapStateService.isSelected(id);
    if (isSelected) {
      this.mapStateService.unselect(id);
    } else {
      const appFeature = this.mapFeatureService.asAppFeature(feature);

      // cache clicked feature data -- needed b/c MapLibre Vector layers can't reliably retrieve by ID (must be in viewport)
      this.mapFeatureService.addCache(appFeature); // cache should be cleared by component using data
      this.destroyRef.onDestroy(() => this.mapFeatureService.removeCache(appFeature));

      this.mapStateService.select(id);
    }

    e.preventDefault();
  }

  onMouseLeave(_: MapMouseEvent & {features?: MapGeoJSONFeature[]} & EventData) {
    if (this.mapStateService.mode() !== 'select') return;

    if (this.interactivity()?.hover) {
      if (this.hoveredFeatureId) {
        this.mapStateService.removeHover(this.hoveredFeatureId);
        this.hoveredFeatureId = null;
      }
    }
  }

  private hoveredFeatureId: FeatureIdentifier | null = null;
  onMouseMove(e: MapMouseEvent & {features?: MapGeoJSONFeature[]} & EventData) {
    if (!this.interactivity()?.hover) return;
    if (this.mapStateService.mode() !== 'select') return;

    const feature = e.features?.[0];
    const id = feature ? this.getIdentifier(feature) : null;

    if (!this.identifierEquals(this.hoveredFeatureId, id)) {
      if (this.hoveredFeatureId) this.mapStateService.removeHover(this.hoveredFeatureId);
      if (id) this.mapStateService.addHover(id);
    }

    this.hoveredFeatureId = id;
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