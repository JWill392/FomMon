
export type LayerKind = string & { readonly __brand: 'LayerKind' };

export class Layer {
  kind: LayerKind;
  name: string;
  description: string;
  tileSource: string;
  color: string;
}
