import {computed, inject, Injectable, signal} from "@angular/core";
import type {FeatureIdentifier} from "maplibre-gl";
import { MapLayerService } from "./layer/map-layer.service";
import {ErrorService} from "../shared/error.service";
import {AreaWatchLayer} from "./layer/area-watch-layer/area-watch-layer";
import {AreaWatchService} from "../area-watch/area-watch.service";

export interface MapSelection {
  layerGroupId: string;
  featureId: FeatureIdentifier;
}

@Injectable({providedIn: 'root'})
export class MapSelectionService {
  private mapLayerService = inject(MapLayerService);
  private errorService = inject(ErrorService);
  private areaWatchService = inject(AreaWatchService);

  readonly selectedAreaWatchId = computed(() => {
    const selected = this.selected();
    if (!selected) return null;
    if (selected.layerGroupId !== AreaWatchLayer.layerGroupId) return null;

    const fid = selected?.featureId.id as number;

    return this.areaWatchService.getByFeatureId(fid).id;
  });

  private _selected = signal<MapSelection | null>(null);
  readonly selected = this._selected.asReadonly();

  selectAreaWatch(id: string): void {
    // TODO
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

    this.selectFeature({source: layerGroup.source, sourceLayer: layerGroup.sourceLayer, id: areaWatch.featureId})
  }

  selectFeature(id: FeatureIdentifier): void {
    if (id === null) {this.clearFeature(); return;}

    const groupId = this.mapLayerService.getGroupIdBySource(id.source, id.sourceLayer);
    if (groupId === undefined) {
      this.errorService.handleError(`No layer found for feature ${id.source}/${id.sourceLayer}/${id.id}`);
      return;
    }

    const mapSelection = {
      layerGroupId: groupId,
      featureId: id,
    }
    this._selected.set(mapSelection);

  }
  clearFeature(): void {
    this._selected.set(null);
  }

}