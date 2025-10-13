import {inject, Injectable, signal} from "@angular/core";
import {ServiceState, ServiceWithState} from "../shared/service-state";
import {ServiceLoadState} from "../shared/service-load-state";
import {HttpClient} from "@angular/common/http";
import {Project} from "./project.model";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";


@Injectable({providedIn: 'root'})
export class ProjectService implements ServiceWithState {
  private http = inject(HttpClient)

  private _state = new ServiceLoadState();
  readonly state = this._state.asReadonly();

  private _data = signal<Project[] | undefined>(undefined);
  readonly data = this._data.asReadonly();

  public initialize$() : Observable<never> {
    const loadUrl = 'api/project';
    return this.http.get<Project[]>(loadUrl)
      .pipe(
        tap((body) => {
          if (!Array.isArray(body)) {
            throw new Error(`Invalid response type @ GET ${loadUrl}; expected array, found ${typeof (body)}`);
          }
          this._data.set(body);
        }),
        this._state.loadState,
      );
  }

}