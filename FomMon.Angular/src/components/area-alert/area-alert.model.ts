import {LayerKind} from "../layer/layer.model";
import {Geometry} from "geojson";
import {LocalStateItem} from "../shared/local-state";

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