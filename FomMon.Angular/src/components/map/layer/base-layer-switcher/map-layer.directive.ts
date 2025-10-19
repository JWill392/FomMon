import {Directive, OnInit, OnDestroy, inject, signal, input, InputSignal} from '@angular/core';
import { LayerComponent } from '@maplibre/ngx-maplibre-gl';
import {LayerSpecification} from "maplibre-gl";
import {LayerCategory, MapLayerService} from "../map-layer.service";


/// Directive to register a layer with the map layer service
/// for managing visibility
/// NOTE: MUST manually wire up layout to the service, eg:
/// [layout]="mapLayerService.getLayout(idOutline)"
@Directive({
  selector: 'mgl-layer[appMapLayer]',
  standalone: true,
})
export class MapLayerDirective implements OnInit, OnDestroy {
  thumbnailImg = input.required<string>();
  name = input.required<string>();
  initiallyVisible = input<boolean>(false);

  category = input.required<LayerCategory>();
  groupId = input.required<string>();

  additionalLayout = input<LayerSpecification['layout']>();

  private layerComponent = inject(LayerComponent);
  protected mapLayerService = inject(MapLayerService);

  protected layerId: InputSignal<string>;


  ngOnInit(): void {
    // Get the layer ID from the LayerComponent
    this.layerId = this.layerComponent.id;


    if (!this.layerId) {
      throw new Error('Layer must have an id');
    }

    if (!this.mapLayerService.tryAddGroup({
      id: this.groupId(),
      name: this.name(),
      thumbnailImg: this.thumbnailImg(),
      visible: this.initiallyVisible(),
      category: this.category(),
      source: this.layerComponent.source(),
      sourceLayer: this.layerComponent.sourceLayer()
    })) {
      const group = this.mapLayerService.getGroup(this.groupId());
      if (this.layerComponent.source() !== group.source) {
        throw new Error(`Layer source must match group source.  
        Group: ${group.source}, Layer: ${this.layerComponent.source()}`);
      }
      if (this.layerComponent.sourceLayer() !== group?.sourceLayer) {
        throw new Error('Layer sourceLayer must match group sourceLayer.  ' +
          'Group: ' + group?.sourceLayer + ', Layer: ' + this.layerComponent.sourceLayer());
      }
    }

    this.mapLayerService.registerLayer({
      id: this.layerId(),
      groupId: this.groupId(),
      layout: this.additionalLayout(),
    });

  }

  ngOnDestroy(): void {
    if (this.layerId) {
      this.mapLayerService.unregisterLayer(this.layerId());
    }
  }

  protected readonly signal = signal;
}