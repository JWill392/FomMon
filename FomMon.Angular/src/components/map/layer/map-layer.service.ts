import {computed, inject, Injectable, signal} from '@angular/core';
import {LayerSpecification} from "maplibre-gl";
import {LocalStorageService} from "../../shared/local-storage.service";

export type LayerCategory = "base"|"feature";

export interface LayerInteractivity {
  select: boolean;
  hover: boolean;
}
export interface LayerGroup {
  id: string;
  name: string;
  thumbnailImg: string;
  visible: boolean;
  category: LayerCategory;

  source: string;
  sourceLayer?: string;

  interactivity: LayerInteractivity
}
export type LayerGroupAdd = Omit<LayerGroup, 'source' | 'sourceLayer'>;
export interface LayerInfo {
  id: string;
  groupId: string;
  layout: LayerSpecification['layout'];

  source: string;
  sourceLayer: string | undefined;
}


/**
 * Service for managing map layer visibility.  Introduces concept of layer groups; semantic layers
 * as opposed to MapLibre's extremely granular rendering layers.
 * All layers added to map should be registered with this service by using MapLayerDirective.
 */
@Injectable({
  providedIn: 'root'
})
export class MapLayerService {
  private _groups = signal<LayerGroup[]>([]);
  private _groupsById = computed(() => new Map(this._groups().map(g => [g.id, g])));
  private _groupsBySource = computed(() => new Map(this._groups().map(g => [this.toSourceKey(g.source, g.sourceLayer), g])));
  private _groupsByCategory = computed(() => Map.groupBy(this._groups(), g => g.category));

  public readonly baseGroups = computed(() => this._groupsByCategory().get('base') ?? []);
  public readonly featureGroups = computed(() => this._groupsByCategory().get('feature') ?? []);

  private _layers = signal<LayerInfo[]>([]);

  private localStorageService = inject(LocalStorageService);
  private static readonly layerVisibilityKey = 'layerVisibility';
  private readonly layerVisibilityDefault : Map<string, boolean>;

  constructor() {
    this.layerVisibilityDefault = this.localStorageService
      .get(MapLayerService.layerVisibilityKey, 1) ?? new Map<string, boolean>();
  }

  addGroup(group: LayerGroupAdd): boolean {
    if (this.getGroup(group.id)) throw new Error(`Group ${group.id} already exists`);

    if (this.layerVisibilityDefault.has(group.id)) {
      group.visible = this.layerVisibilityDefault.get(group.id)!;
    }

    this._groups.update(groups => [...groups, {
      ...group,
      source:'',
      sourceLayer:''
    }]);
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

    if (!group.source) {
      group.source = layerAdd.source;
      group.sourceLayer = layerAdd.sourceLayer;
    } else if (group.source !== layerAdd.source ||
        group.sourceLayer !== layerAdd.sourceLayer) {

      throw new Error(`Layer ${layerAdd.id} already registered with different source`);
    }

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
  getGroupBySource(source: string, sourceLayer?: string) : LayerGroup | undefined {
    return this._groupsBySource().get(this.toSourceKey(source, sourceLayer));
  }

  private getLayers(groupId: string | string[] | LayerGroup | LayerGroup[] = []) {
    const groupIds = (Array.isArray(groupId) ? groupId : [groupId])
      .map(g => typeof g === 'string' ? g : g.id);

    return this._layers().filter(l => groupIds.includes(l.groupId));
  }
  getLayerIds(groupId: string | string[] | LayerGroup | LayerGroup[] = []) {
    return this.getLayers(groupId).map(l => l.id);
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