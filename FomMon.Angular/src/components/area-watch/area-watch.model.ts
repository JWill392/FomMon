import {Geometry} from 'geojson';
import {LocalState, LocalStateItem} from "../shared/service/local-state";
import {LayerKind} from "../layer-type/layer-type.model";

export interface AreaWatch extends LocalStateItem {
  geometry: Geometry;
  id: string;
  name: string;
  layers: LayerKind[];
  featureId: number; // maplibre requires int ids

  localState: LocalState;
}

export type AreaWatchDto = Omit<AreaWatch, 'localState'>;
export type AreaWatchAdd = Omit<AreaWatchDto, 'id' | 'featureId'>;
