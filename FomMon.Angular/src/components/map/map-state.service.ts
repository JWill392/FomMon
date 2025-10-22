import {computed, inject, Injectable, signal} from "@angular/core";
import {MapLayerService} from "./layer/map-layer.service";
import {ErrorService} from "../shared/error.service";
import {Observable, Subject} from "rxjs";
import {Geometry} from "geojson";
import {tap} from "rxjs/operators";
import {FeatureIdentifier, Map as MapLibreMap} from 'maplibre-gl';

export interface MapSelection {
  layerGroupId: string;
  featureId: FeatureIdentifier;
}

export type MapMode = 'select' | 'draw' | 'none'; // TODO map mode

/**
 * Service to manage the current map selection and mode.
 */
@Injectable({providedIn: 'root'})
export class MapStateService {
  private mapLayerService = inject(MapLayerService);
  private errorService = inject(ErrorService);

  private _selected = signal<MapSelection | null>(null);
  readonly selected = this._selected.asReadonly();

  private _hovered = signal<MapSelection[]>([]);
  readonly hovered = this._hovered.asReadonly();

  private _mode = signal<MapMode>('none');
  readonly mode = this._mode.asReadonly();

  private _map = signal<MapLibreMap | undefined>(undefined);
  readonly map = this._map.asReadonly();

  private _drawResult$ : Subject<Geometry> | undefined;
  get drawResult$() : Subject<Geometry> | undefined {return this._drawResult$};

  initializeMap(map: MapLibreMap) {
    if (this._map()) {
      this.errorService.handleError(new Error('Map already initialized'));
      return;
    }
    this._map.set(map);
  }
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

  startSelectMode() {
    if (this._mode() === 'select') return;
    this.setMode('select');
  }

  private setMode(mode: MapMode) {
    const lastMode = this._mode();
    if (lastMode === mode) return;

    if (lastMode === 'draw') {
      this._drawResult$?.complete();
      this._drawResult$ = undefined;

    } else if (lastMode === 'select') {
      this.clearSelection();
      this.clearHover();
    }
    this._mode.set(mode);
  }


  select(id: FeatureIdentifier): void {
    if (id === null) {this.clearSelection(); return;}

    const mapSelection = this.toMapSelection(id);
    this._selected.set(mapSelection);
  }
  clearSelection(): void {
    this._selected.set(null);
  }

  addHover(id: FeatureIdentifier): void {
    if (id === null) return;
    if (this.isHovered(id)) return;

    this._hovered.update(s => [...s, this.toMapSelection(id)]);
  }
  removeHover(id: FeatureIdentifier): void {
    if (id === null) return;
    if (!this.isHovered(id)) return;

    this._hovered.update(s => s.filter(s => s.featureId.id !== id.id));
  }
  clearHover(): void {
    this._hovered.set([]);
  }

  private isHovered(id: FeatureIdentifier) : boolean {
    return this._hovered().some(s => s.featureId.id === id.id);
  }

  private toMapSelection(id: FeatureIdentifier) : MapSelection {
    const groupId = this.mapLayerService.getGroupIdBySource(id.source, id.sourceLayer);
    if (groupId === undefined) {
      this.errorService.handleError(`No layer found for feature ${id.source}/${id.sourceLayer}/${id.id}`);
      return {layerGroupId: '', featureId: id};
    }
    return {layerGroupId: groupId, featureId: id};
  }
}
