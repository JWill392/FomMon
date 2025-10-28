import {computed, inject, Injectable, signal} from '@angular/core';
import {LayerSpecification} from "maplibre-gl";
import {LocalStorageService} from "../../shared/local-storage.service";

export type LayerCategory = "base"|"feature"|"internal";

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
  order: number;

  source: string;
  sourceLayer?: string;

  interactivity: LayerInteractivity
}
export type LayerGroupAdd = Omit<LayerGroup, 'source' | 'sourceLayer'>;

export interface LayerInfo {
  id: string;
  groupId: string;
  layout: LayerSpecification['layout'];

  order: number;
  subOrder: number;

  source: string;
  sourceLayer: string | undefined;
}
export type LayerInfoAdd = Omit<LayerInfo, 'order' | 'subOrder'>;


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
  public readonly layers = this._layers.asReadonly();

  private localStorageService = inject(LocalStorageService);
  private static readonly layerVisibilityKey = 'layerVisibility';
  private readonly layerVisibilityDefault : Map<string, boolean>;

  /** detect layer order changes only */
  public readonly layerOrderSignature = computed(() =>
    this._layers()?.map(l => `${l.order}:${l.subOrder}:${l.id}`).join(',')
  );

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


  addLayer(add: LayerInfoAdd) {
    if (!add) throw new Error('Layer is required');
    if (this.getLayer(add.id)) throw new Error(`Layer ${add.id} already registered`);

    const group = this.getGroup(add.groupId);
    if (!group) throw new Error(`Group ${add.groupId} not found`);

    if (!group.source) {
      group.source = add.source;
      group.sourceLayer = add.sourceLayer;
    } else if (group.source !== add.source ||
        group.sourceLayer !== add.sourceLayer) {

      throw new Error(`Layer ${add.id} already registered with different source`);
    }

    // order layers within groups based on add order
    const subOrder = this.getLayers(add.groupId).length;
    const added = {
      ...add
      , layout: this.layoutWithVisibility(add.layout, group.visible)
      , order: group.order
      , subOrder
    };

    this._layers.update(layers =>
      MapLayerService.withInserted(layers, added, (a, b) =>
        a.order - b.order ||
        a.source.localeCompare(b.source) ||
        a.sourceLayer?.localeCompare(b.sourceLayer) ||
        a.subOrder - b.subOrder))
  }

  removeLayer(id: string): void {
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


  /** Non-mutable sorted insert */
  private static withInserted<T>(list: T[], item: T, compare: (a: T, b: T) => number) : T[] {
    const index = list.findIndex(l => compare(l, item) > 0);
    if (index === -1) {
      return [...list, item];
    } else {
      return [
        ...list.slice(0, index),
        item,
        ...list.slice(index)
      ]
    }
  }
}