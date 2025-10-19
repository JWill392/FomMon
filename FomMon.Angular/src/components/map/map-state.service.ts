import {computed, inject, Injectable, signal} from "@angular/core";
import type {FeatureIdentifier} from "maplibre-gl";
import {MapLayerService} from "./layer/map-layer.service";
import {ErrorService} from "../shared/error.service";
import {AreaWatchLayer} from "./layer/area-watch-layer/area-watch-layer";
import {AreaWatchService} from "../area-watch/area-watch.service";

export interface MapSelection {
  layerGroupId: string;
  featureId: FeatureIdentifier;
}

export type MapMode = 'select' | 'draw' | 'none';

@Injectable({providedIn: 'root'})
export class MapStateService {
  private mapLayerService = inject(MapLayerService);
  private errorService = inject(ErrorService);

  private _selected = signal<MapSelection | null>(null);
  readonly selected = this._selected.asReadonly();



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