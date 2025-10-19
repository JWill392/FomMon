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

  constructor() {

    // deselect on delete
    effect(() => {
      const selected = this.selectedAreaWatchId();
      this.areaWatchService.data(); // subscribe to changes

      if (!selected) return;
      if (!this.areaWatchService.get(selected)) {
        this.mapStateService.clearFeature();
        return;
      }
    })
  }

  select(id: string): void {
    const layerGroup = this.mapLayerService.getGroup(AreaWatchLayer.layerGroupId);
    if (!layerGroup) {
      this.errorService.handleError(`No layer group found for ${AreaWatchLayer.layerGroupId}`);
      return;
    }

    const areaWatch = this.areaWatchService.get(id);
    if (!areaWatch) {
      this.errorService.handleError(`No area watch found for ${id}`);
      return;
    }


    this.mapStateService.selectFeature({
      source: layerGroup.source,
      sourceLayer: layerGroup.sourceLayer,
      id: areaWatch.featureId
    })
  }
  private getAreaWatch(selection: MapSelection) {
    if (!selection) return null;
    if (selection.layerGroupId !== AreaWatchLayer.layerGroupId) return null;

    const fid = selection?.featureId.id as number;

    return this.areaWatchService.getByFeatureId(fid)?.id;
  }
}