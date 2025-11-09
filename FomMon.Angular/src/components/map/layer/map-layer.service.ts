import {computed, inject, Injectable, signal} from '@angular/core';
import {LayerSpecification} from "maplibre-gl";
import {LocalStorageService} from "../../shared/local-storage.service";
import {StackMap} from "../../../datastructures/stack-map";

export type LayerCategory = "base"|"feature"|"internal";

export type LayerVisibilitySnapshot = Map<string, boolean>;
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

// TODO manage base layer order.  Labels should go above features.

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
  private _groupsBySource = computed(() => new Map(this._groups().map(g => [this._toSourceKey(g.source, g.sourceLayer), g])));
  private _groupsByCategory = computed(() => Map.groupBy(this._groups(), g => g.category));

  public readonly baseGroups = computed(() => this._groupsByCategory().get('base') ?? []);
  public readonly featureGroups = computed(() => this._groupsByCategory().get('feature') ?? []);

  private _layers = signal<LayerInfo[]>([]);
  public readonly layers = this._layers.asReadonly();

  private localStorageService = inject(LocalStorageService);
  private static readonly layerVisibilityKey = {key:'layerVisibility', version:1} as const;

  private readonly visDefault : string = "default";
  private readonly visStack : StackMap<string, boolean>

  /** detect layer order changes only */
  public readonly layerOrderSignature = computed(() =>
    this._layers()?.map(l => `${l.order}:${l.subOrder}:${l.id}`).join(',')
  );

  constructor() {
    const defaultVisibility = this.localStorageService
      .get<LayerVisibilitySnapshot>(MapLayerService.layerVisibilityKey)
      ?? new Map<string, boolean>();

    this.visStack = new StackMap();
    this.visStack.pushMap(this.visDefault);
    this.visStack.setMany(this.visDefault, defaultVisibility);
    this._syncVisibility(this.visDefault)
  }

  addGroup(group: LayerGroupAdd): boolean {
    if (this.getGroup(group.id)) throw new Error(`Group ${group.id} already exists`);

    if (!this.visStack.hasIn(this.visDefault, group.id)) {
      this.visStack.setIn(this.visDefault, group.id, group.visible);
    }
    group.visible = this.visStack.get(group.id);

    this._groups.update(groups => [...groups, {
      ...group,
      source:'', // currently set from add layer; TODO set in group by making directive on Source
      sourceLayer:''
    }]);
    return true;
  }

  removeGroup(id: string): void {
    this._removeGroup(id);
    this._layers.update(layers => layers.filter(l => l.groupId !== id));
  }
  private _removeGroup(id: string): void {
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
    const subOrder = this._getLayers(add.groupId).length;
    const added = {
      ...add
      , layout: this._layoutWithVisibility(add.layout, group.visible)
      , order: group.order
      , subOrder
    };

    this._layers.update(layers =>
      MapLayerService._withOrderedInsert(layers, added, (a, b) =>
        a.order - b.order ||
        a.source.localeCompare(b.source) ||
        a.sourceLayer?.localeCompare(b.sourceLayer) ||
        a.subOrder - b.subOrder))
  }

  removeLayer(id: string): void {
    const group = this.getLayer(id)?.groupId;
    this._layers.update(layers => layers.filter(l => l.id !== id));
    if (!this._layers().some(l => l.groupId === group)) {
      this._removeGroup(group);
    }
  }
  selectBaseLayer(groupId: string): void {
    this._groups().filter(g => g.category === 'base')
      .forEach(g => this.setVisibility(g.id, g.id === groupId));
  }


  getGroup(id: string) : LayerGroup | undefined {
    return this._groupsById().get(id)
  }

  private _getLayers(groupId: string | string[] | LayerGroup | LayerGroup[] = []) {
    const groupIds = (Array.isArray(groupId) ? groupId : [groupId])
      .map(g => typeof g === 'string' ? g : g.id);

    return this._layers().filter(l => groupIds.includes(l.groupId));
  }
  getLayer(id: string) : LayerInfo | undefined {
    return this._layers().find(l => l.id === id);
  }
  getLayout(id: string) : LayerSpecification['layout']  {
    const layer = this.getLayer(id);
    if (!layer) {
      return {};
    }

    return layer.layout;
  }



  private _toSourceKey = (source : string, sourceLayer?: string) => source + sourceLayer?`:${sourceLayer}`:'';
  getGroupBySource(source: string, sourceLayer?: string) : LayerGroup | undefined {
    return this._groupsBySource().get(this._toSourceKey(source, sourceLayer));
  }

  /** Non-mutable sorted insert */
  private static _withOrderedInsert<T>(list: T[], item: T, compare: (a: T, b: T) => number) : T[] {
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





  /** Set visibility of a layer and record original state in snapshot */
  pushVisibilitySnapshot(snapshotName: string) {
    return this.visStack.pushMap(snapshotName);
  }

  setVisibility(groupId: string, visible: boolean, snapshotName?: string) : boolean {
    if (!snapshotName) {snapshotName = this.visDefault}

    const changed = this.visStack.setIn(snapshotName, groupId, visible);
    if (changed) this._syncVisibility(snapshotName);
    return changed;
  }
  setVisibilityMany(visibility: LayerVisibilitySnapshot, snapshotName?: string) : boolean {
    if (!snapshotName) {snapshotName = this.visDefault}

    const changed = this.visStack.setMany(snapshotName, visibility);
    if (changed) this._syncVisibility(snapshotName);
    return changed;
  }


  /** Restore visibility of layers from snapshot */
  popVisibilitySnapshot(name: string) : boolean {
    const changed = !!this.visStack.popMap(name);
    if (changed) this._syncVisibility(name);
    return changed;
  }


  private _syncVisibility(changedSnapshot?: string) {
    for (const group of this._groups()) {
      const visible = this.visStack.get(group.id)
      if (visible === undefined) continue;
      this._setVisibility(group.id, visible);
    }

    if (changedSnapshot === this.visDefault) {
      const visDefaultValue = this.visStack.getAllIn(this.visDefault)
      this.localStorageService.set(MapLayerService.layerVisibilityKey, visDefaultValue);
    }
  }

  private _setVisibility(groupId: string, value : boolean): void {
    let group = this.getGroup(groupId);
    if (!group) return;
    if (group.visible === value) return;
    group = {
      ...group,
      visible: value
    }

    this._groups.update(groups => groups.map(g => g.id === groupId ? group : g))

    this._layers.update(layers => layers.map(l => {
      if (l.groupId !== groupId) return l;
      return ({
        ...l,
        layout: this._layoutWithVisibility(l.layout, group.visible)
      });
    }));
  }

  private _layoutWithVisibility(layout: LayerSpecification['layout'], visible: boolean): LayerSpecification['layout'] {
    return {
      ...layout,
      visibility: visible ? 'visible' : 'none'
    };
  }
}