
export type LayerKind = string & { readonly __brand: 'LayerKind' };

export interface LayerType {
  kind: LayerKind;
  name: string;
  featureName: string;
  description: string;
  tileSource: string;
  color: string;
  geometryType: "LINESTRING" | "POLYGON";
  attribution: string;
  sourceIdColumn: string;

  // set in config service
  source: string;
  sourceLayer: string;
}

export type LayerTypeDto = Omit<LayerType, 'source' | 'sourceLayer'>;
