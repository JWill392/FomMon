import {computed, inject, Injectable, signal} from "@angular/core";
import type {FeatureIdentifier} from "maplibre-gl";
import {MapLayerService} from "./layer/map-layer.service";
import {ErrorService} from "../shared/error.service";
import {Observable, Subject} from "rxjs";
import {Geometry} from "geojson";
import {tap} from "rxjs/operators";

export interface MapSelection {
  layerGroupId: string;
  featureId: FeatureIdentifier;
}

export type MapMode = 'select' | 'draw' | 'none'; // TODO map mode

@Injectable({providedIn: 'root'})
export class MapStateService {
  private mapLayerService = inject(MapLayerService);
  private errorService = inject(ErrorService);

  private _selected = signal<MapSelection | null>(null);
  readonly selected = this._selected.asReadonly();

  private _mode = signal<MapMode>('none');
  readonly mode = this._mode.asReadonly();

  private _drawResult$ : Subject<Geometry> | undefined;
  get drawResult$() : Subject<Geometry> | undefined {return this._drawResult$};

  startDrawMode(): Observable<Geometry> {
    if (this._mode() === 'draw') return this._drawResult$.asObservable();

    this.setMode('draw');

    this._drawResult$ = new Subject<Geometry>();
    this._drawResult$.pipe(
      tap({
        complete: () => this.endDrawMode(),
        error: () => this.endDrawMode(),
      })
    );

    return this._drawResult$.asObservable();
  }

  endDrawMode() {
    if (this._mode() !== 'draw') return;
    this.setMode('select');
  }

  private setMode(mode: MapMode) {
    const lastMode = this._mode();
    if (lastMode === mode) return;

    console.log(`setMode ${lastMode}->${mode}`);

    if (lastMode === 'draw') {
      this._drawResult$?.complete();
      this._drawResult$ = undefined;

    } else if (lastMode === 'select') {
      this.clearSelection();

    }
    this._mode.set(mode);
  }


  select(id: FeatureIdentifier): void {
    if (id === null) {this.clearSelection(); return;}

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
  clearSelection(): void {
    this._selected.set(null);
  }



}