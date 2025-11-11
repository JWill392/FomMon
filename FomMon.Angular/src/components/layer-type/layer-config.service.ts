import {LayerKind, LayerType, LayerTypeDto} from './layer-type.model';
import {computed, inject, Injectable, signal} from '@angular/core';
import {tap} from 'rxjs/operators';
import {HttpClient} from '@angular/common/http';
import {ServiceLoadState} from "../shared/service/service-load-state";
import {ServiceWithState} from "../shared/service/service-state";
import {Observable} from "rxjs";

/**
 * Service for retrieving API config of feature layer types.
 */
@Injectable({
  providedIn: 'root'
})
export class LayerConfigService implements ServiceWithState {
  private http = inject(HttpClient);

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<LayerType[]>([]);
  readonly data = this._data.asReadonly();

  private readonly byKind = computed(() => Object.fromEntries(this.data()?.map(l => [l.kind, l])));
  readonly kinds = computed(() =>  this.data()?.map(l => l.kind));

  initialize$(): Observable<never> {
    let loadUrl = '/api/layer';
    return this.http.get<LayerTypeDto[]>(loadUrl)
      .pipe(
        tap((body) => {
            if (!Array.isArray(body)) {
              throw new Error(`Invalid response type @ GET ${loadUrl}; expected array, found ${typeof (body)}`);
            }
            const layerTypes = body.map(this.layerTypeFactory.bind(this));
            this._data.set(layerTypes)
          }
        ),
        this._state.loadState
      )
  }

  private layerTypeFactory(dto: LayerTypeDto) : LayerType {
    return {
      ...dto,
      source: dto.kind as string,
      sourceLayer: dto.tileSource
    }
  }

  get(kind : LayerKind) : LayerType | undefined {
    return this.byKind()[kind];
  }


  getGroupId(kind : LayerKind) {
    return kind as string;
  }
  getByGroupId(groupId : string) {
    const kind = groupId as LayerKind; // mapping is 1-to-1 currently
    return this.byKind()[kind];
  }
  getBySource(source : string, sourceLayer? : string) {
    return this.data().find(l => l.source === source && l.sourceLayer === sourceLayer);
  }
}
