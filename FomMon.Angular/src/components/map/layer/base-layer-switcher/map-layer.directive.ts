import {Directive, OnInit, OnDestroy, inject, input, InputSignal, computed, Signal} from '@angular/core';
import {EventData, LayerComponent} from '@maplibre/ngx-maplibre-gl';
import {FeatureIdentifier, LayerSpecification, MapGeoJSONFeature, MapMouseEvent} from "maplibre-gl";
import {LayerGroup, LayerInteractivity, MapLayerService} from "../map-layer.service";
import {ErrorService} from "../../../shared/error.service";
import {MapStateService} from "../../map-state.service";


/**
 * Directive to register a layer with the map layer service
 * for managing visibility
 * NOTE: MUST manually wire up layout to the service, eg:
 * [layout]="mapLayerService.getLayout(idOutline)"
 */
@Directive({
  selector: 'mgl-layer[appMapLayer]',
  standalone: true,
  host: {
    '(layerClick)': 'onClick($event)',
    '(layerMouseLeave)': 'onMouseLeave($event)',
    '(layerMouseMove)': 'onMouseMove($event)',
  }
})
export class MapLayerDirective implements OnInit, OnDestroy {
  private layerComponent = inject(LayerComponent);
  protected mapLayerService = inject(MapLayerService);
  private mapStateService = inject(MapStateService);
  private errorService = inject(ErrorService);

  protected layerId: InputSignal<string>;

  groupId = input.required<string>();
  additionalLayout = input<LayerSpecification['layout']>();

  /** Override group interactivity setting. Recommended for borders and labels,
   * as tiny features tend to break mouseenter/leave events. */
  overrideInteractivity = input<LayerInteractivity | undefined>();
  private group : Signal<LayerGroup> = computed(() => this.mapLayerService.getGroup(this.groupId()));
  private interactivity : Signal<LayerInteractivity> = computed(() => this.overrideInteractivity() ??  this.group()?.interactivity ?? {select: false, hover: false});

  ngOnInit(): void {
    // Get the layer ID from the LayerComponent
    this.layerId = this.layerComponent.id;
    if (!this.layerId) {
      this.errorService.handleError(new Error('Layer must have an id'));
      return;
    }

    this.mapLayerService.addLayer({
      id: this.layerId(),
      groupId: this.groupId(),
      layout: this.additionalLayout(),
      source: this.layerComponent.source(),
      sourceLayer: this.layerComponent.sourceLayer(),
    });

  }

  ngOnDestroy(): void {
    if (this.layerId) {
      this.mapLayerService.removeLayer(this.layerId());
    }
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
    const current : FeatureIdentifier | null = this.getIdentifier(e.features?.[0]);

    if (!this.identifierEquals(this.hoveredFeatureId, current)) {
      if (this.hoveredFeatureId) this.mapStateService.removeHover(this.hoveredFeatureId)
      if (current) this.mapStateService.addHover(current)
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