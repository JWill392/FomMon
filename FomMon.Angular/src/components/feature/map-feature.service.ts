import {inject, Injectable, signal} from "@angular/core";
import {LayerKind} from "../layer-type/layer-type.model";
import {FeatureIdentifier, MapGeoJSONFeature} from "maplibre-gl";
import {LayerConfigService} from "../layer-type/layer-config.service";


export interface AppFeature extends AppFeatureId {
  properties: Record<string, any>,
}

export interface AppFeatureId {
  id: number | string,
  kind: LayerKind,
}

@Injectable({
  providedIn: 'root'
})
export class MapFeatureService {
  private layerConfigService = inject(LayerConfigService);

  private _cache = signal<AppFeature[]>([])


  public asAppFeature(mapFeature: MapGeoJSONFeature) : AppFeature {
    const kind = this.getKind(mapFeature);
    return {
      id: mapFeature.id,
      kind,
      properties: mapFeature.properties
    }
  }

  public addCache(feature: AppFeature | MapGeoJSONFeature) {
    const asFeature = this.isAppFeatureId(feature) ? feature : this.asAppFeature(feature);
    this._cache.update(c => [...c, asFeature]);
  }

  public removeCache(feature: AppFeatureId | FeatureIdentifier) {
    this._cache.update(c => c.filter(f => !this.equals(f, feature)));
  }

  public equals(a: AppFeatureId, b: AppFeatureId | FeatureIdentifier) : boolean {
    if (!a || !b) return false;
    const bkind = this.getKind(b);

    return a.kind === bkind && a.id.toString() === b.id.toString()
  }

  private getKind(feature: AppFeatureId | FeatureIdentifier) : LayerKind {
    if (this.isAppFeatureId(feature)) return feature.kind;
    return this.layerConfigService.getBySource(feature.source, feature.sourceLayer)?.kind;
  }

  private isAppFeatureId(feature: AppFeatureId | FeatureIdentifier): feature is AppFeatureId {
    return 'kind' in feature && 'id' in feature;
  }

  public get(id: AppFeatureId | FeatureIdentifier) : AppFeature | undefined {
    const cached = this._cache().find(f => this.equals(f, id));
    if (cached) return cached;

    console.warn(`FeatureService: getFid not found in cache:`, id);
    // TODO fetch from server...
    return undefined;
  }


}