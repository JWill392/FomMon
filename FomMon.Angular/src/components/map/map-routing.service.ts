import {effect, inject, Injectable} from "@angular/core";
import {MapSelection, MapStateService} from "./map-state.service";
import {FeatureIdentifier} from "maplibre-gl";
import {NavigationExtras, Router} from "@angular/router";

export interface RouteNavigationParams {
  commands: readonly any[],
  extras?: NavigationExtras,
}
export type MapRouteHandler = (featureId: FeatureIdentifier) => RouteNavigationParams | undefined;
export interface MapRouteOptions {
  closeOnDeselect: boolean // TODO do this
}

@Injectable({ providedIn: 'root'})
export class MapRoutingService {
  private mapStateService = inject(MapStateService);
  private router = inject(Router);

  private handlerConfig = new Map<string, { handler: MapRouteHandler, options: MapRouteOptions }>();




  constructor() {
    effect(() => {
      const selection = this.mapStateService.selected();
      if (!selection) return;

      // TODO close detail panel if opened by map router, and if not edit mode
      this.handleSelection(selection);
    })
  }

  registerSelectRouting(layerGroupId: string, handler: MapRouteHandler, options: MapRouteOptions = {closeOnDeselect: true}) {
    this.handlerConfig.set(layerGroupId, {handler, options});
  }



  private handleSelection(selection: MapSelection) {
    const {layerGroupId, featureId} = selection;

    const cfg = this.handlerConfig.get(layerGroupId);
    if (!cfg) return;

    const navigationDestination = cfg.handler(featureId);
    if (!navigationDestination) return;

    // TODO don't route if already here.

    this.router.navigate(navigationDestination.commands, {
      ...navigationDestination.extras,
      preserveFragment: true,

    });
  }

}