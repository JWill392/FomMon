
import {Geometry} from "geojson";
import {LocalStateItem} from "../shared/local-state";
import {LayerKind} from "../layer-type/layer-type.model";

export interface AreaAlert extends LocalStateItem{
  id: number,
  areaWatchId: string,
  triggeredAt: string,
  featureReference: {
    id: number
    layerKind: LayerKind,
    sourceFeatureId: string,

    firstSeenAt: string,
    lastSeenAt: string,
    deletedAt: string,
    isDeleted: Boolean,

    geometry: Geometry
  }
}