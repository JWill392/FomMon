import {
  Component,
  ChangeDetectionStrategy,
  input,
  output, inject, Signal, computed,
} from '@angular/core';
import {
  LayerComponent,
} from '@maplibre/ngx-maplibre-gl';
import {
  LayerSpecification,
  FilterSpecification,
  MapLayerMouseEvent,
  MapLayerTouchEvent, MapMouseEvent, MapGeoJSONFeature, FeatureIdentifier,
} from 'maplibre-gl';
import type { EventData } from '@maplibre/ngx-maplibre-gl';
import {LayerGroup, LayerInteractivity, MapLayerService} from "../map-layer.service";
import {MapStateService} from "../../map-state.service";

/**
 * Wrapper component for mgl-layer that registers with MapLayerService
 * for managing visibility and interactivity.
 * Automatically manages the layout property.
 */
@Component({
  selector: 'app-layer',
  standalone: true,
  imports: [LayerComponent],
  templateUrl: './app-layer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayerComponent {
  protected mapLayerService = inject(MapLayerService);
  private mapStateService = inject(MapStateService);

  groupId = input.required<string>();

  /** Override group interactivity setting. Recommended for borders and labels,
   * as tiny features tend to break mouseenter/leave events. */
  overrideInteractivity = input<LayerInteractivity | undefined>();

  private group: Signal<LayerGroup> = computed(() => this.mapLayerService.getGroup(this.groupId()));
  private interactivity: Signal<LayerInteractivity> = computed(() =>
    this.overrideInteractivity() ?? this.group()?.interactivity ?? {select: false, hover: false}
  );
  protected serviceLayout = computed(() => this.mapLayerService.getLayout(this.id()));

  /** LayerComponent inputs **/
  // Required inputs
  readonly id = input.required<LayerSpecification['id']>();
  readonly type = input.required<LayerSpecification['type']>();

  // Optional inputs
  readonly source = input<string>();
  readonly metadata = input<LayerSpecification['metadata']>();
  readonly sourceLayer = input<string>();
  readonly filter = input<FilterSpecification>();
  readonly layoutInput = input<LayerSpecification['layout']>({}, {alias: 'layout'});
  readonly paintInput = input<LayerSpecification['paint']>({}, {alias: 'paint'});
  protected paintLoose = computed<any>(() => this.paintInput()); // workaround ngx-maplibre outdated maplibre types

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


  ngOnInit(): void {
    this.mapLayerService.addLayer({
      id: this.id(),
      groupId: this.groupId(),
      layout: this.layoutInput(),
      source: this.source(),
      sourceLayer: this.sourceLayer(),
    });
  }

  ngOnDestroy(): void {
    this.mapLayerService.removeLayer(this.id());
  }

  onClick(e: MapMouseEvent & {features?: MapGeoJSONFeature[]} & EventData) {
    if (!this.interactivity().select) return;
    if (this.mapStateService.mode() !== 'select') return;
    if (e.features && e.features.length > 0) {
      const clickId = this.getIdentifier(e.features[0]);
      if (!clickId) return;

      this.mapStateService.toggleSelect(clickId);
    } else {
      this.mapStateService.clearSelection();
    }

    e.preventDefault();
  }

  onMouseLeave(_: MapMouseEvent & {features?: MapGeoJSONFeature[]} & EventData) {
    if (this.mapStateService.mode() !== 'select') return;

    if (this.interactivity().hover) {
      if (this.hoveredFeatureId) {
        this.mapStateService.removeHover(this.hoveredFeatureId);
        this.hoveredFeatureId = null;
      }
    }
  }

  private hoveredFeatureId: FeatureIdentifier | null = null;
  onMouseMove(e: MapMouseEvent & {features?: MapGeoJSONFeature[]} & EventData) {
    if (!this.interactivity().hover) return;
    if (this.mapStateService.mode() !== 'select') return;
    const current: FeatureIdentifier | null = this.getIdentifier(e.features?.[0]);

    if (!this.identifierEquals(this.hoveredFeatureId, current)) {
      if (this.hoveredFeatureId) this.mapStateService.removeHover(this.hoveredFeatureId);
      if (current) this.mapStateService.addHover(current);
    }

    this.hoveredFeatureId = current;
  }

  private getIdentifier(f: MapGeoJSONFeature): FeatureIdentifier | null {
    if (!f) return null;
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