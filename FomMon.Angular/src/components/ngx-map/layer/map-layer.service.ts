import {computed, effect, Injectable, signal} from '@angular/core';
import {LayerSpecification} from "maplibre-gl";

export type LayerCategory = "base"|"feature";

export interface LayerGroup {
  id: string;
  name: string;
  thumbnailImg: string;
  visible: boolean;
  category: LayerCategory;
}
export interface LayerInfo {
  id: string;
  groupId: string;
  layout: LayerSpecification['layout'];
}

@Injectable({
  providedIn: 'root'
})
export class MapLayerService {
  private _groups = signal<LayerGroup[]>([]);
  private _groupsById = computed(() => new Map(this._groups().map(g => [g.id, g])));
  private _groupsByCategory = computed(() => Map.groupBy(this._groups(), g => g.category));

  public readonly baseGroups = computed(() => this._groupsByCategory().get('base'));
  public readonly featureGroups = computed(() => this._groupsByCategory().get('feature'));

  private _layers = signal<LayerInfo[]>([]);
  public readonly baseLayers = computed(() => this._layers().filter(l => this.baseGroups().some(g => g.id === l.groupId)));
  public readonly featureLayers = computed(() => this._layers().filter(l => this.featureGroups().some(g => g.id === l.groupId)));

  tryAddGroup(group: LayerGroup): boolean {
    if (this.getGroup(group.id)) return false;

    this._groups.update(groups => [...groups, group]);
    return true;
  }

  private removeGroup(id: string): void {
    this._groups.update(groups => groups.filter(g => g.id !== id));
  }

  // TODO change to list of groups w/ layer children
  registerLayer(layerAdd: LayerInfo) {
    if (!layerAdd) throw new Error('Layer is required');
    if (this.getLayer(layerAdd.id)) throw new Error(`Layer ${layerAdd.id} already registered`);

    const group = this.getGroup(layerAdd.groupId);
    if (!group) throw new Error(`Group ${layerAdd.groupId} not found`);

    const addWithVisibility = {
      ...layerAdd
      , layout: this.layoutWithVisibility(layerAdd.layout, group.visible)
    };

    this._layers.update(layers => [
      ...layers,
      addWithVisibility
      ]
    );
  }

  unregisterLayer(id: string): void {
    const group = this.getLayer(id)?.groupId;
    this._layers.update(layers => layers.filter(l => l.id !== id));
    if (!this._layers().some(l => l.groupId === group)) {
      this.removeGroup(group);
    }
  }

  selectBaseLayer(groupId: string): void {
    this._groups().filter(g => g.category === 'base')
      .forEach(g => this.setVisibility(g.id, g.id === groupId));
  }

  // setVisibility(groupId: string, visible: boolean): void {
  //   this.setVisibility(groupId, visible);
  // }

  setVisibility(groupId: string, value : boolean): void {
    let group = this.getGroup(groupId);
    if (!group) return;
    group = {
      ...group,
      visible: value
    }

    this._groups.update(groups => groups.map(g => g.id === groupId ? group : g))

    this._layers.update(layers => layers.map(l => {
      if (l.groupId !== groupId) return l;
      return ({
        ...l,
        layout: this.layoutWithVisibility(l.layout, group.visible)
      });
    }));
  }

  getGroup(id: string) : LayerGroup | undefined {
    return this._groupsById().get(id)
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