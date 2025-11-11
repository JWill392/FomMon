
export type LayerKind = string & { readonly __brand: 'LayerKind' };

export interface LayerType {
  kind: LayerKind;
  name: string;
  featureName: string;
  description: string;
  tileSource: string;
  sourceIdColumn: string;
  color: string;
  geometryType: "LINESTRING" | "POLYGON";
  attribution: string;
  columns: LayerTypeColumn[];

  // set in config service
  source: string;
  sourceLayer: string;
}

export interface LayerTypeColumn {
  name: string;
  decode: string;
  visibility: "visible" | "hidden";
}

export type LayerTypeDto = Omit<LayerType, 'source' | 'sourceLayer'>;
