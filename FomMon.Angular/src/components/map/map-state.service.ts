import {inject, Injectable, signal} from "@angular/core";
import {MapLayerService} from "./layer/map-layer.service";
import {ErrorService} from "../shared/error.service";
import {Observable, Subject} from "rxjs";
import {Geometry} from "geojson";
import {tap} from "rxjs/operators";
import {FeatureIdentifier, Map as MapLibreMap} from 'maplibre-gl';
import {fidEquals} from "./map-util";

export interface MapSelection {
  layerGroupId: string;
  featureId: FeatureIdentifier; // TODO refactor so groupid === source + sourceLayer? equality is annoying though.
}

export type MapMode = 'select' | 'draw' | 'none'; // TODO map mode

export interface FlyToCommand {
  featureId: FeatureIdentifier;
  geometry: Geometry
}

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

  padding = signal<{padding: {top: number, bottom: number, left: number, right: number}, durationMs: number}>
    ({padding: {top: 0, bottom: 0, left: 0, right: 0}, durationMs: 0});

  private _drawResult$ : Subject<Geometry> | undefined;
  get drawResult$() : Subject<Geometry> | undefined {return this._drawResult$};

  private _flyToCommand$ = new Subject<FlyToCommand>();
  readonly flyToCommand$ = this._flyToCommand$.asObservable();

  private _currentFlyTo$: Subject<void> | undefined;

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

  flyTo(feature: FeatureIdentifier, geometry: Geometry): Observable<void> {
    // cancel in-progress flight
    if (this._currentFlyTo$) {
      this._currentFlyTo$.complete();
    }

    this._currentFlyTo$ = new Subject<void>();
    this._flyToCommand$.next({featureId: feature, geometry: geometry});

    return this._currentFlyTo$.asObservable().pipe(
      tap({
        finalize: () => this._currentFlyTo$ = undefined,
      })
    );
  }
  flyToComplete() {
    if (!this._currentFlyTo$) return;
    this._currentFlyTo$.next();
    this._currentFlyTo$.complete();
  }
  flyToError(error: any): void {
    this._currentFlyTo$?.error(error);
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


  toggleSelect(id: FeatureIdentifier): void {
    if (this.isSelected(id)) {
      this.clearSelection();
    } else {
      this.select(id);
    }
  }
  select(id: FeatureIdentifier): void {
    if (id === null) return;

    const mapSelection = this.toMapSelection(id);
    this._selected.set(mapSelection);
  }
  unselect(id: FeatureIdentifier): void {
    if (!fidEquals(this._selected().featureId, id)) return;
    this.clearSelection();
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

    this._hovered.update(s => s.filter(s => !fidEquals(s.featureId,id)));
  }
  clearHover(): void {
    this._hovered.set([]);
  }

  private isHovered(id: FeatureIdentifier | null) : boolean {
    if (id === null) return false;
    return this._hovered().some(s => fidEquals(s.featureId, id));
  }

  private isSelected(id: FeatureIdentifier | null) : boolean {
    if (id === null) return false;
    return fidEquals(this._selected()?.featureId, id);
  }

  private toMapSelection(id: FeatureIdentifier) : MapSelection {
    const groupId = this.mapLayerService.getGroupBySource(id.source, id.sourceLayer)?.id;
    if (groupId === undefined) {
      this.errorService.handleError(`No layer found for feature ${id.source}/${id.sourceLayer}/${id.id}`);
      return {layerGroupId: '', featureId: id};
    }
    return {layerGroupId: groupId, featureId: id};
  }



}
