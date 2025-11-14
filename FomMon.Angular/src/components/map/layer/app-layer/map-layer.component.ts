import {ChangeDetectionStrategy, Component, computed, inject, input, output,} from '@angular/core';
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
import {asFid} from "../../map-util";


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

  // State Events
  readonly beforeSelect = output<MapGeoJSONFeature>();

  // MapLibre Events
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
    if (!this.interactivity()?.select) return;
    if (this.mapStateService.mode() !== 'select') return;
    if (!e.features?.length) {
      return;
    }

    const feature = e.features[0];
    const id = asFid(feature);

    this.beforeSelect.emit(feature);

    this.mapStateService.toggleSelect(id);

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
    const id = feature ? asFid(feature) : null;

    if (!this.identifierEquals(this.hoveredFeatureId, id)) {
      if (this.hoveredFeatureId) this.mapStateService.removeHover(this.hoveredFeatureId);
      if (id) this.mapStateService.addHover(id);
    }

    this.hoveredFeatureId = id;
  }



  private identifierEquals(a: FeatureIdentifier | null, b: FeatureIdentifier | null) {
    if (!a || !b) return false;
    return a.source === b.source && a.sourceLayer === b.sourceLayer && a.id === b.id;
  }
}