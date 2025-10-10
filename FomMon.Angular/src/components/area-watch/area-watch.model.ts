import {Geometry} from 'geojson';
import {LayerKind} from '../layer/layer.model';
import {LocalState, LocalStateItem} from "../shared/local-state";

export interface AreaWatch extends LocalStateItem {
  geometry: Geometry;
  localState: LocalState;
  id: string;
  name: string;
  layers: LayerKind[];
  featureId: number; // maplibre requires int ids
}

export type AreaWatchDto = Omit<AreaWatch, 'localState'>;
export type AreaWatchAdd = Omit<AreaWatchDto, 'id' | 'featureId'>;
