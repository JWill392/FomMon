import {computed, effect, inject, Injectable, signal} from "@angular/core";
import type {FeatureIdentifier} from "maplibre-gl";
import {MapLayerService} from "../map-layer.service";
import {ErrorService} from "../../../shared/error.service";
import {AreaWatchLayer} from "./area-watch-layer";
import {AreaWatchService} from "../../../area-watch/area-watch.service";
import {MapStateService} from "../../map-state.service";

export interface MapSelection {
  layerGroupId: string;
  featureId: FeatureIdentifier;
}

export type MapMode = 'select' | 'draw' | 'none';

@Injectable({providedIn: 'root'})
export class AreaWatchLayerService {
  private mapLayerService = inject(MapLayerService);
  private errorService = inject(ErrorService);
  private areaWatchService = inject(AreaWatchService);
  private mapStateService = inject(MapStateService);

  readonly selectedAreaWatchId = computed(() => this.getAreaWatch(this.mapStateService.selected()));
  readonly hoveredAreaWatchIds = computed(() => this.mapStateService.hovered().map(s => this.getAreaWatch(s)).filter(a => a !== null));

  private _layerGroup = computed(() => this.mapLayerService.featureGroups().find(g => g.id === AreaWatchLayer.layerGroupId));

  constructor() {

    // deselect on delete
    effect(() => {
      const selected = this.selectedAreaWatchId();
      // TODO make this generic and in group component or directive
      this.areaWatchService.data(); // subscribe to changes

      if (!selected) return;
      if (!this.areaWatchService.get(selected)) {
        this.mapStateService.clearSelection();
        return;
      }
    })
  }

  select(id: string): void {
    const fid = this.toFeatureIdentifier(id);
    if (!fid) return;

    this.mapStateService.select(fid);
  }
  addHover(id: string): void {
    const fid = this.toFeatureIdentifier(id);
    if (!fid) return;

    this.mapStateService.addHover(fid);
  }
  removeHover(id: string): void {
    const fid = this.toFeatureIdentifier(id);
    if (!fid) return;
    this.mapStateService.removeHover(fid);
  }

  private toFeatureIdentifier(id: string) : FeatureIdentifier | null {
    const areaWatch = this.areaWatchService.get(id);
    if (!areaWatch) {
      this.errorService.handleError(`No area watch found for ${id}`);
      return null;
    }
    if (!this._layerGroup()) return null;

    return {
      source: this._layerGroup()?.source,
      sourceLayer: this._layerGroup()?.sourceLayer,
      id: areaWatch.featureId
    };
  }
  private getAreaWatch(selection: MapSelection) {
    if (!selection) return null;
    if (selection.layerGroupId !== AreaWatchLayer.layerGroupId) return null;

    const fid = selection?.featureId.id as number;

    return this.areaWatchService.getByFeatureId(fid)?.id;
  }
}