import {LayerType} from './layer-type.model';
import {computed, inject, Injectable, signal} from '@angular/core';
import {tap} from 'rxjs/operators';
import {HttpClient} from '@angular/common/http';
import {ServiceLoadState} from "../shared/service-load-state";
import {ServiceWithState} from "../shared/service-state";
import {Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class LayerTypeService implements ServiceWithState {
  private http = inject(HttpClient);

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<LayerType[] | undefined>(undefined);
  readonly data = this._data.asReadonly();

  byKind = computed(() =>
      Object.fromEntries(this.data()?.map(l => [l.kind, l]))
    );
  kinds = computed(() => this.data()?.map(l => l.kind));

  initialize$(): Observable<never> {
    let loadUrl = '/api/layer';
    return this.http.get<LayerType[]>(loadUrl)
      .pipe(
        tap((body) => {
            if (!Array.isArray(body)) {
              throw new Error(`Invalid response type @ GET ${loadUrl}; expected array, found ${typeof (body)}`);
            }
            this._data.set(body)
          }
        ),
        this._state.loadState
      )
  }
}
