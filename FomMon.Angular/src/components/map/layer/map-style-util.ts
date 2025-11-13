import {ExpressionSpecification} from "maplibre-gl";
import {Pipe, PipeTransform} from "@angular/core";


@Pipe({name: 'isState'})
export class MapStyleIsStatePipe implements PipeTransform {
  transform(state: string) : ExpressionSpecification {
    return ['boolean', ['feature-state', state], false]
  }
}