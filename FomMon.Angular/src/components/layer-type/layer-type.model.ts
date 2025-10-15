
export type LayerKind = string & { readonly __brand: 'LayerKind' };

export class LayerType {
  kind: LayerKind;
  name: string;
  description: string;
  tileSource: string;
  color: string;
  geometryType: "LINESTRING" | "POLYGON";
  attribution: string;
  sourceIdColumn: string;
}
