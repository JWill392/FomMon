import {DestroyRef, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AreaWatch, AreaWatchAdd, AreaWatchDto} from './area-watch.model';
import {catchError, ignoreElements, map, tap} from 'rxjs/operators';
import {EMPTY, throwError} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import { v4 as uuidv4 } from 'uuid';
import {LocalState, ServiceState} from '../shared/state';
import {AuthServiceBase} from '../shared/auth-service-base';


@Injectable({providedIn: 'root'})
export class AreaWatchService extends AuthServiceBase<AreaWatch[]> {
  private loadUrl = 'api/areawatch';
  private http = inject(HttpClient);

  private featureToId = new Map<number, string>();
  private idToFeature = new Map<string, number>();
  private nextFeatureId = 1;

  protected override load$(destroyRef : DestroyRef) {
    return this.http.get<AreaWatch[]>(this.loadUrl)
      .pipe(
        tap((body) => {
            if (!Array.isArray(body)) {
              throw new Error(`Invalid response type @ GET ${this.loadUrl}; expected array, found ${typeof(body)}`);
            }
            body.forEach(aw => {
              aw.localState = LocalState.added;
              aw.featureId = this.getOrAddFeatureId(aw.id);
            });
            this._data.set(body)
          }
        ),
        takeUntilDestroyed(destroyRef)
      );
  }

  createId(aw : AreaWatchAdd) {
    const id = uuidv4();

    return ({
      id: id,
      featureId: this.getOrAddFeatureId(id),
      ...aw
    })
  }

  add$(addDto : AreaWatchDto) {
    if (this._state() !== ServiceState.ready) {throw new Error('Service not ready')}
    const addAw = {...addDto, localState: LocalState.pending_add};
    if (this.find(addDto.id)) {
      // already exists
      return EMPTY;
    }

    this.addLocal(addAw);

    return this.http.post<AreaWatch>('api/areawatch', addAw)
      .pipe(
        catchError((error) => throwError(() => {
          addAw.localState = LocalState.deleted;
          this.removeLocal(addAw);
          return error;
        })),
        map(result => ({...result, localState: LocalState.added})),
        tap(added => {
          this.updateLocal(added);
        })
      )
  }

  delete$(del : AreaWatch) {
    if (this._state() !== ServiceState.ready) {throw new Error('Service not ready')}
    if (!this.find(del.id)) {
      // already deleted
      return EMPTY;
    }

    del.localState = LocalState.pending_delete;
    this.removeLocal(del);

    return this.http.delete(`api/areawatch/${del.id}`)
      .pipe(
        catchError((error) => throwError(() => {
          del.localState = LocalState.added;
          this.addLocal(del)
          return error;
        })),
        map(result => ({...result, localState: LocalState.deleted})),
      )
  }

  patch$(pat : Partial<AreaWatch>) {
    if (this._state() !== ServiceState.ready) {throw new Error('Service not ready')}
    const original = {...this.find(pat.id)};
    if (!original) {
      // does not exist
      return EMPTY;
    }

    pat.localState = LocalState.pending_edit;
    this.updateLocal(pat);

    return this.http.patch(`api/areawatch/${pat.id}`, pat)
      .pipe(
        catchError((error) => throwError(() => {
          pat.localState = LocalState.added;
          this.updateLocal(original) // revert edit

          return error;
        })),
        map(result => ({...result, localState: LocalState.added})),
        tap(result => this.updateLocal(result))
      )
  }

  private getOrAddFeatureId(id : string) {
    if (this.idToFeature.has(id)) {
      return this.idToFeature.get(id)!;
    }

    const fid = this.nextFeatureId++;

    this.featureToId.set(fid, id);
    this.idToFeature.set(id, fid);

    return fid;
  }

  public getByFeatureId(fid : number) {
    return this._data().find(a => a.featureId === fid);
  }

  private find(id : string) : AreaWatch | undefined {
    return this._data().find(a => a.id === id);
  }
  private removeLocal(aw : AreaWatch) {
    this._data.update(arr => arr.filter(a => a.id !== aw.id));
  }
  private addLocal(aw : AreaWatch) {
    this._data.update(arr => arr.concat([aw]));
  }
  private updateLocal(aw : Partial<AreaWatch>) {
    this._data.update(arr => arr.map(a => a.id === aw.id ? {...a, ...aw} : a));
  }

}
