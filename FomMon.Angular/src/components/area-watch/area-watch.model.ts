import {Geometry} from 'geojson';
import {LocalState, LocalStateItem} from "../shared/local-state";
import {LayerKind} from "../layer-type/layer-type.model";

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
