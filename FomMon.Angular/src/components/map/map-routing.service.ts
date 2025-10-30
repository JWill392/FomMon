import {effect, inject, Injectable} from "@angular/core";
import {MapSelection, MapStateService} from "./map-state.service";
import {FeatureIdentifier} from "maplibre-gl";
import {fidEquals} from "./map-util";

@Injectable({ providedIn: 'root'})
export class MapRoutingService {
  private mapStateService = inject(MapStateService);

  private routingHandlers = new Map<string, (featureId: FeatureIdentifier) => void>();


  constructor() {
    let lastSelection: MapSelection | null = null;
    effect(() => {
      const selection = this.mapStateService.selected(); // TODO wrong; should still route if deselect and reselect same feature.  key is not if already open.
      const changed = !fidEquals(lastSelection?.featureId, selection?.featureId);
      if (!selection || !changed) return;

      // TODO close detail panel if opened by map router, and if not edit mode
      this.handleSelection(selection);
      lastSelection = selection;
    })
  }

  registerLayerRouting(layerGroupId: string, handler: (featureId: FeatureIdentifier) => void) {
    this.routingHandlers.set(layerGroupId, handler);
  }

  private handleSelection(selection: MapSelection) {
    const {layerGroupId, featureId} = selection;

    const handler = this.routingHandlers.get(layerGroupId);
    if (!handler) return;

    handler(featureId);
  }

}