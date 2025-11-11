import {ExpressionSpecification} from "maplibre-gl";

export function isState(state: string) : ExpressionSpecification {
  return ['boolean', ['feature-state', state], false]
}