import {computed, DestroyRef, effect, inject, Injectable, signal} from "@angular/core";
import {AreaAlert} from "./area-alert.model";
import {Observable} from "rxjs";
import {ServiceState, ServiceWithState} from "../shared/service-state";
import {HttpClient} from "@angular/common/http";
import {ServiceLoadState} from "../shared/service-load-state";
import {tap} from "rxjs/operators";
import {LocalState} from "../shared/local-state";
import {UserService} from "../user/user.service";
import {LayerService} from "../layer/layer.service";


@Injectable({providedIn: 'root'})
export class AreaAlertService implements ServiceWithState {
  private http = inject(HttpClient);
  private userService = inject(UserService);
  private layerService = inject(LayerService);

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<AreaAlert[] | undefined>(undefined);
  readonly data = this._data.asReadonly();

  readonly byLayer = computed(() => {
    const alerts = this.data();
    if (alerts === undefined) return undefined;
    return Map.groupBy(this.data(),
      (a) => a.featureReference.layerKind)
  });

  constructor() {
    effect(() => {
      const isLoggedOut = !this.userService.state.isReady();
      if (isLoggedOut) {
        this._state.reset();
        this._data.set(undefined);
      }
    });
  }

  initialize$(): Observable<never> {
    return this.http.get<AreaAlert[]>('api/alert')
      .pipe(
        tap((body) => {
          if (!Array.isArray(body)) {
            throw new Error(`Invalid response type @ GET api/areaalert; expected array, found ${typeof (body)}`);
          }
          body.forEach(aw => aw.localState = LocalState.added);
          this._data.set(body);
        }),
        this._state.loadState,
      )

  }
}