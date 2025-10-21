import {computed, effect, inject, Injectable, OnInit, signal} from '@angular/core';
import {FeatureIdentifier, LayerSpecification} from "maplibre-gl";
import {LocalStorageService} from "../../shared/local-storage.service";

export type LayerCategory = "base"|"feature";

export interface LayerGroup {
  id: string;
  name: string;
  thumbnailImg: string;
  visible: boolean;
  category: LayerCategory;

  source: string;
  sourceLayer: string | undefined;
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
  private _groupsBySource = computed(() => new Map(this._groups().map(g => [this.toSourceKey(g.source, g.sourceLayer), g])));
  private _groupsByCategory = computed(() => Map.groupBy(this._groups(), g => g.category));

  public readonly baseGroups = computed(() => this._groupsByCategory().get('base'));
  public readonly featureGroups = computed(() => this._groupsByCategory().get('feature'));

  private _layers = signal<LayerInfo[]>([]);

  private localStorageService = inject(LocalStorageService);
  private static readonly layerVisibilityKey = 'layerVisibility';
  private readonly layerVisibilityDefault : Map<string, boolean>;

  constructor() {
    this.layerVisibilityDefault = this.localStorageService
      .get(MapLayerService.layerVisibilityKey, 1) ?? new Map<string, boolean>();
  }

  tryAddGroup(group: LayerGroup): boolean {
    if (this.getGroup(group.id)) return false;

    if (this.layerVisibilityDefault.has(group.id)) {
      group.visible = this.layerVisibilityDefault.get(group.id)!;
    }

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

    this.layerVisibilityDefault.set(groupId, value);
    this.localStorageService.set(MapLayerService.layerVisibilityKey, this.layerVisibilityDefault, 1);
  }

  getGroup(id: string) : LayerGroup | undefined {
    return this._groupsById().get(id)
  }

  private toSourceKey = (source : string, sourceLayer?: string) => source + sourceLayer?`:${sourceLayer}`:'';
  getGroupIdBySource(source: string, sourceLayer?: string) : string | undefined {
    return this._groupsBySource().get(this.toSourceKey(source, sourceLayer)).id;
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