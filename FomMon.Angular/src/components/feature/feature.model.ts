import {LayerKind} from "../layer-type/layer-type.model";
import {Geometry} from "geojson";
import {FeatureIdentifier} from "maplibre-gl";

// TODO get from schema validation type infer
export interface AppFeature extends FeatureIdentifier {
  id: number,
  kind: LayerKind,
  geometry: Geometry,
  properties: Record<string, any>,


  source: string,
  sourceLayer: string | undefined,
}

export type AppFeatureDto = Omit<AppFeature, 'source' | 'sourceLayer'> // received from api without source/layer