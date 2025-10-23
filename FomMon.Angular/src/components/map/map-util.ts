import {FeatureIdentifier} from "maplibre-gl";

export function fidEquals(
  a: FeatureIdentifier | null | undefined,
  b: FeatureIdentifier | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.source === b.source && a.sourceLayer === b.sourceLayer && a.id === b.id;
}