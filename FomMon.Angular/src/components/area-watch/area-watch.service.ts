import {effect, inject, Injectable, signal, untracked} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {AreaWatch, AreaWatchAdd, AreaWatchDto, ThumbnailUrl} from './area-watch.model';
import {catchError, map, tap} from 'rxjs/operators';
import {EMPTY, Observable, of, throwError} from 'rxjs';
import {v4 as uuidv4} from 'uuid';
import {ServiceLoadState} from "../shared/service/service-load-state";
import {UserService} from "../user/user.service";
import {LoadState, ServiceWithState} from "../shared/service/service-state";
import {LocalState} from "../shared/service/local-state";
import {Theme, ThemeService} from "../shared/theme.service";
import {ErrorService} from "../shared/error.service";
import {FeatureIdentifier} from "maplibre-gl";

export type AreaWatchPatch = Partial<AreaWatch> & {id: string};

@Injectable({providedIn: 'root'})
export class AreaWatchService implements ServiceWithState {
  private themeService = inject(ThemeService);
  private http = inject(HttpClient);
  private userService = inject(UserService);
  private errorService = inject(ErrorService);

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<AreaWatch[]>([]);
  readonly data = this._data.asReadonly();

  private readonly _thumbnailCache = signal(new Map<string, Map<Theme, ThumbnailUrl>>());

  // MAP LAYER interop
  private featureToId = new Map<number, string>();
  private idToFeature = new Map<string, number>();
  private nextFeatureId = 1;

  readonly groupId = 'area-watches';
  readonly sourceId = this.groupId;
  readonly sourceLayer: string | undefined = undefined; // only for vector layers

  public constructor() {
    effect(() => {
      const isLoggedOut = !this.userService.state.isReady();
      const hasData = this.state.value() !== LoadState.idle;

      if (isLoggedOut && hasData) {
        this._state.reset();
        this._data.set([]);
      }
    })

    effect(() => {
      const theme = this.themeService.theme();
      const data = untracked(this._data);

      for (const aw of data) {
        // TODO change to resource to avoid duplicate requests
        this._downloadThumbnailCached$(aw.id, theme)
          .subscribe();
      }

    })
  }


  public initialize$() : Observable<never> {
    const loadUrl = 'api/areawatch';
    return this.http.get<AreaWatch[]>(loadUrl)
      .pipe(
        catchError((error) => throwError(() => {
          this.errorService.handleError(new Error(`Failed to get areawatchs`, {cause: error}));
          return error;
        })),
        tap((body) => {
            if (!Array.isArray(body)) {
              throw new Error(`Invalid response type @ GET ${loadUrl}; expected array, found ${typeof (body)}`);
            }
            body.forEach(aw => {
              aw.localState = LocalState.added;
              aw.featureId = this.mapToFeatureId(aw.id);

              // TODO change to resources.  this is bad because it allows multiple concurrent requests, doesn't accommodate retries or error handling well.
              this._downloadThumbnailCached$(aw.id, this.themeService.theme())
                .subscribe();
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
  public toFeatureIdentifier(aw: AreaWatch) : FeatureIdentifier {
    return {
      source: this.sourceId,
      sourceLayer: this.sourceLayer,
      id: aw.featureId
    };
  }


  add$(addDto : AreaWatchDto) {
    this._state.assertReady();
    const addAw = {...addDto,
      localState: LocalState.pending_add};
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
          this.errorService.handleError(new Error(`Failed to add areawatch ${addAw}`, {cause: error}));
          return error;
        })),
        map(result => ({...result, localState: LocalState.added})),
        tap(added => {
          this.patchLocal(added);
        })
      )
  }



  private _clearThumbnailCache(id: string, theme?: Theme) {
    if (!this._thumbnailCache().has(id)) return;

    this._thumbnailCache.update(thumbnails => {
      const newThumbnails = new Map(thumbnails);
      if (theme) {
        newThumbnails.get(id)?.delete(theme);
      } else {
        newThumbnails.delete(id)
      }
      return newThumbnails;
    });
  }
  getThumbnail(id: string, theme?: Theme) : ThumbnailUrl | undefined {
    if (!theme) theme = this.themeService.theme();
    const themeMap = this._thumbnailCache().get(id);
    if (!themeMap) return undefined;

    return themeMap.get(theme)
  }
  refreshThumbnail(id: string, theme: Theme) {
    this._clearThumbnailCache(id, theme);
    this._downloadThumbnailCached$(id, theme) // TODO change to resource
      .subscribe();
  }
  private _downloadThumbnailCached$(id: string, theme: Theme) : Observable<ThumbnailUrl> {
    const cache = this.getThumbnail(id);
    if (cache) return of(cache);

    //console.log('AWS: Thumbnail cache miss; downloading', theme, id);
    const params = new HttpParams()
      .append('theme', theme);

    return this.http.get<ThumbnailUrl>
    (`api/areawatch/${id}/thumbnail`, {params})
    .pipe(
      catchError((error) => throwError(() => {

        // TODO handle 404
        this.errorService.handleError(new Error(`Failed to get thumbnail for areawatch ${id}`, {cause: error}));
        return error;
      })),
      tap(result => {
        this._setThumbnail(id, result);
      })
    )
  }

  uploadThumbnail$(id: string, theme: Theme, image: Blob, name: string, paramHash: string) {
    const formData = new FormData();
    formData.append('file', image, name)

    let queryParms = new HttpParams()
      .append('theme', theme)
      .append('paramHash', paramHash);

    return this.http.post<ThumbnailUrl>
    (`api/areawatch/${id}/thumbnail`, formData, {params: queryParms})
      .pipe(
        catchError((error) => throwError(() => {
          this.errorService.handleError(new Error(`Failed to upload thumbnail for areawatch ${id}`, {cause: error}));
          return error;
        })),
        tap(result => this._setThumbnail(id, result))
      )
  }

  private _setThumbnail(id : string, thumbnail: ThumbnailUrl) {
    let themeMap = this._thumbnailCache().get(id);
    if (!themeMap) {
      themeMap = new Map<Theme, ThumbnailUrl>();
    }
    themeMap.set(thumbnail.theme, thumbnail);

    this._thumbnailCache.update(thumbnails => {
      const newThumbnails = new Map(thumbnails);
      newThumbnails.set(id, themeMap);
      return newThumbnails;
    });
  }

  delete$(del : AreaWatch) {
    this._state.assertReady();
    const original = this.get(del.id);
    if (!original || original.localState !== LocalState.added) {
      // already deleted or other pending operation
      return EMPTY;
    }

    del.localState = LocalState.pending_delete;
    this.removeLocal(del);

    return this.http.delete(`api/areawatch/${del.id}`)
      .pipe(
        catchError((error) => throwError(() => {
          del.localState = LocalState.added;
          this.addLocal(del)
          this.errorService.handleError(new Error(`Failed to delete areawatch ${del.id}`, {cause: error}));
          return error;
        })),
        map(result => ({...result, localState: LocalState.deleted})),
      )
  }

  patch$(pat : AreaWatchPatch) {
    this._state.assertReady();

    const original = {...this.get(pat.id)};
    if (!original || original.localState !== LocalState.added) {
      // does not exist or another edit is pending
      this.errorService.warn('Cannot apply edit, as Watch has already been changed', original.localState)
      return EMPTY;
    }

    pat.localState = LocalState.pending_edit;
    this.patchLocal(pat);


    return this.http.patch(`api/areawatch/${pat.id}`, pat)
      .pipe(
        catchError((error) => throwError(() => {
          pat.localState = LocalState.added;
          this.patchLocal(original) // revert edit

          return this.errorService.handleError(new Error(`Failed to patch areawatch ${pat.id}`), error);
        })),
        map(result => ({...result, localState: LocalState.added})),
        tap(result => {
          this.patchLocal(result)
          if (pat.geometry !== undefined) {
            this._clearThumbnailCache(pat.id);
          }
        })
      )
  }



  public getByFeatureId(fid : number | string) {
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
  private patchLocal(aw : Partial<AreaWatch>) {
    if (!(aw?.id)) throw new Error("argument aw must have id element");
    this._data.update(arr => arr.map(a => a.id === aw.id ? {...a, ...aw} : a));
  }

}
