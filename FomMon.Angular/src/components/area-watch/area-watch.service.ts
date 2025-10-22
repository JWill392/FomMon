import {effect, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AreaWatch, AreaWatchAdd, AreaWatchDto} from './area-watch.model';
import {catchError, map, tap} from 'rxjs/operators';
import {EMPTY, Observable, throwError} from 'rxjs';
import {v4 as uuidv4} from 'uuid';
import {ServiceLoadState} from "../shared/service/service-load-state";
import {UserService} from "../user/user.service";
import {LoadState, ServiceWithState} from "../shared/service/service-state";
import {LocalState} from "../shared/service/local-state";


@Injectable({providedIn: 'root'})
export class AreaWatchService implements ServiceWithState {
  private http = inject(HttpClient);
  private userService = inject(UserService);

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<AreaWatch[]>(undefined);
  readonly data = this._data.asReadonly();

  private featureToId = new Map<number, string>();
  private idToFeature = new Map<string, number>();
  private nextFeatureId = 1;

  public constructor() {
    effect(() => {
      const isLoggedOut = !this.userService.state.isReady();
      const hasData = this.state.value() !== LoadState.idle;

      if (isLoggedOut && hasData) {
        this._state.reset();
        this._data.set(undefined);
      }
    })
  }

  public initialize$() : Observable<never> {
    const loadUrl = 'api/areawatch';
    return this.http.get<AreaWatch[]>(loadUrl)
      .pipe(
        tap((body) => {
            if (!Array.isArray(body)) {
              throw new Error(`Invalid response type @ GET ${loadUrl}; expected array, found ${typeof (body)}`);
            }
            body.forEach(aw => {
              aw.localState = LocalState.added;
              aw.featureId = this.mapToFeatureId(aw.id);
            });
            this._data.set(body)
          }
        ),
        this._state.loadState
      );
  }

  createId(aw : AreaWatchAdd) {
    const id = uuidv4();

    return ({
      id: id,
      featureId: this.mapToFeatureId(id),
      ...aw
    })
  }

  // maintain local numeric id for mapLibre usage
  private mapToFeatureId(id : string) {
    if (this.idToFeature.has(id)) {
      return this.idToFeature.get(id)!;
    }

    const fid = this.nextFeatureId++;

    this.featureToId.set(fid, id);
    this.idToFeature.set(id, fid);

    return fid;
  }


  add$(addDto : AreaWatchDto) {
    this._state.assertReady();
    const addAw = {...addDto, localState: LocalState.pending_add};
    if (this.get(addDto.id)) {
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
    this._state.assertReady();
    if (!this.get(del.id)) {
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
    this._state.assertReady();

    const original = {...this.get(pat.id)};
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

  public getByFeatureId(fid : number) {
    return this._data().find(a => a.featureId === fid);
  }

  public get(id : string) : AreaWatch | undefined {
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
