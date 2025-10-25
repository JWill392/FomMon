import {FeatureIdentifier, LngLatBoundsLike} from "maplibre-gl";
import {bbox} from '@turf/bbox';
import {Feature, FeatureCollection, Geometry, GeometryCollection} from "geojson";



export function fidEquals(
  a: FeatureIdentifier | null | undefined,
  b: FeatureIdentifier | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.source === b.source && a.sourceLayer === b.sourceLayer && a.id === b.id;
}

export function boundingBox(geom : FeatureCollection | Feature | Geometry | GeometryCollection) : LngLatBoundsLike {
  return bbox(geom) as [number, number, number, number];
}