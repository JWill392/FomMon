import {Injectable, signal} from "@angular/core";
import {Map as MapLibreMap} from "maplibre-gl";

@Injectable({
  providedIn: 'root'
})
export class AppMapService {

  private _map = signal<MapLibreMap>(undefined)
  public map = this._map.asReadonly();

  register(map: MapLibreMap) {
    this._map.set(map);
  }
}