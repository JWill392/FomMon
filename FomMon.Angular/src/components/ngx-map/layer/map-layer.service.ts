import {Injectable, InputSignal, signal} from '@angular/core';
import {LayerSpecification} from "maplibre-gl";

export interface LayerInfo {
  id: string;
  name: string;
  thumbnailImg: string;
  visible: boolean;
  layout: LayerSpecification['layout'];
}

@Injectable({
  providedIn: 'root'
})
export class MapLayerService {
  private _layers = signal<LayerInfo[]>([]);
  public readonly layers = this._layers.asReadonly();

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

  selectLayer(id: string): void {
    this._layers.update(layers =>
       layers.map(l => ({
          ...l,
          visible: l.id === id,
          layout: this.layoutWithVisibility(l.layout, l.id === id)
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