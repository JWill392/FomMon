import {Directive, Input, OnInit, OnDestroy, inject, signal, input, InputSignal} from '@angular/core';
import { LayerComponent } from '@maplibre/ngx-maplibre-gl';
import {LayerSpecification} from "maplibre-gl";
import {MapLayerService} from "../map-layer.service";

@Directive({
  selector: 'mgl-layer[appMapLayer]',
  standalone: true,
})
export class MapLayerDirective implements OnInit, OnDestroy {
  thumbnailImg = input.required<string>();
  name = input.required<string>();
  initiallyVisible = input<boolean>(false);

  additionalLayout = input<LayerSpecification['layout']>();

  private layerComponent = inject(LayerComponent);
  protected mapLayerService = inject(MapLayerService);

  protected layerId: InputSignal<string>;


  ngOnInit(): void {
    // Get the layer ID from the LayerComponent
    this.layerId = this.layerComponent.id;

    if (!this.layerId) {
      console.error('BaseLayerSwitchableDirective: Layer must have an id');
      return;
    }

    // Register this layer with the service
    this.mapLayerService.registerLayer({
      id: this.layerId(),
      name: this.name(),
      thumbnailImg: this.thumbnailImg(),
      visible: this.initiallyVisible(),
      layout: this.additionalLayout()
    });

  }

  ngOnDestroy(): void {
    if (this.layerId) {
      this.mapLayerService.unregisterLayer(this.layerId());
    }
  }

  protected readonly signal = signal;
}