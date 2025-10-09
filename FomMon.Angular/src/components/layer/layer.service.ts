import {ServiceBase} from '../shared/service-base';
import {Layer, LayerKind} from './layer.model';
import {computed, DestroyRef, inject, Injectable} from '@angular/core';
import {tap} from 'rxjs/operators';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LayerService extends ServiceBase<Layer[]> {
  private loadUrl = '/api/layer';
  private http = inject(HttpClient);

  byKind = computed(() =>
      Object.fromEntries(this.data()?.map(l => [l.kind, l]))
    );

  protected load$(destroyRef : DestroyRef) {
    return this.http.get<Layer[]>(this.loadUrl)
      .pipe(
        tap((body) => {
            if (!Array.isArray(body)) {
              throw new Error(`Invalid response type @ GET ${this.loadUrl}; expected array, found ${typeof(body)}`);
            }
            this._data.set(body)
          }
        ),
        takeUntilDestroyed(destroyRef)
      );
  }
}
