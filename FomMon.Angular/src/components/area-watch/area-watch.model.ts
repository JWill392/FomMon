import {Geometry} from 'geojson';
import {LocalState, LocalStateItem} from "../shared/service/local-state";
import {LayerKind} from "../layer-type/layer-type.model";

export interface AreaWatch extends LocalStateItem {
  geometry: Geometry;
  localState: LocalState;
  id: string;
  name: string;
  layers: LayerKind[];
  thumbnailImageObjectName: string;
  thumbnailImageUrl: string;
  featureId: number; // maplibre requires int ids
}

export type AreaWatchDto = Omit<AreaWatch, 'localState' | 'thumbnailImageObjectName' | 'thumbnailImageUrl'>;
export type AreaWatchAdd = Omit<AreaWatchDto, 'id' | 'featureId'>;
