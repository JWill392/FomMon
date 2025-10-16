import {computed, Injectable, signal} from '@angular/core';
import {LayerSpecification} from "maplibre-gl";

export type LayerCategory = "base"|"feature";
export interface LayerInfo {
  id: string;
  name: string;
  thumbnailImg: string;
  visible: boolean;
  category: LayerCategory;
  group: string;
  layout: LayerSpecification['layout'];
}

@Injectable({
  providedIn: 'root'
})
export class MapLayerService {
  private _layers = signal<LayerInfo[]>([]);
  public readonly baseLayers = computed(() => this._layers().filter(l => l.category === 'base'));
  public readonly featureLayers = computed(() => this._layers().filter(l => l.category === 'feature'));

  // TODO change to list of groups w/ layer children
  registerLayer(layer: LayerInfo): void {
    this._layers.update(layers => [
      ...layers,
      {...layer
        , layout: this.layoutWithVisibility(layer.layout, layer.visible)}
      ]);
  }

  unregisterLayer(id: string): void {
    this._layers.update(layers => layers.filter(l => l.id !== id));
  }

  selectBaseLayer(group: string): void {
    this._layers.update(layers =>
       layers.map(l => l.category !== 'base' ? l : ({
          ...l,
          visible: l.group === group,
          layout: this.layoutWithVisibility(l.layout, l.group === group)
       }))
    );
  }

  toggleVisibility(group: string): void {
    this._layers.update(layers =>
      layers.map(l => l.group !== group ? l : ({
        ...l,
        visible: !l.visible,
        layout: this.layoutWithVisibility(l.layout, !l.visible)
      }))
    );
  }

  getLayer(id: string) {
    return this._layers().find(l => l.id === id);
  }
  getLayout(id: string) {
    return this.getLayer(id)?.layout;
  }

  private layoutWithVisibility(layout: LayerSpecification['layout'], visible: boolean): LayerSpecification['layout'] {
    return {
      ...layout,
      visibility: visible ? 'visible' : 'none'
    };
  }

}