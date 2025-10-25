import {LocalStateItem} from "../shared/service/local-state";
import {LayerKind} from "../layer-type/layer-type.model";

export interface AreaAlert extends LocalStateItem{
  id: number,
  areaWatchId: string,
  triggeredAt: string,
  featureReference: {
    id: number
    layerKind: LayerKind,
    sourceFeatureId: number,

    firstSeenAt: string,
    lastSeenAt: string,
    deletedAt: string,
    isDeleted: Boolean,

  }
}