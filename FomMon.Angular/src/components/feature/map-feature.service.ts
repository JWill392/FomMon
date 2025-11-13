import {inject, Injectable} from "@angular/core";
import {FeatureIdentifier, MapGeoJSONFeature} from "maplibre-gl";
import {LayerConfigService} from "../layer-type/layer-config.service";
import {HttpClient, HttpParams} from "@angular/common/http";
import {ErrorService} from "../shared/error.service";
import {AppFeature, AppFeatureDto} from "./feature.model";
import {fidEquals} from "../map/map-util";
import * as z from "zod";
import {GeoJSONGeometrySchema} from "zod-geojson";
import {LayerKind} from "../layer-type/layer-type.model";
import {Observable, of, throwError} from "rxjs";
import {catchError, map, tap} from "rxjs/operators";


@Injectable({
  providedIn: 'root'
})
export class MapFeatureService {
  private layerConfigService = inject(LayerConfigService);
  private http = inject(HttpClient);
  private errorService = inject(ErrorService);

  private _cache : AppFeature[] = [];



  public asAppFeature(mapFeature: MapGeoJSONFeature) : AppFeature {
    const layer = this.layerConfigService.getBySource(mapFeature.source, mapFeature.sourceLayer);
    if (!layer) throw new Error(`No layer found for source ${mapFeature.source} and layer ${mapFeature.sourceLayer}`);

    if (!Number.isInteger(mapFeature.id)) {
      throw new Error(`Invalid feature id ${mapFeature.id}`);
    }
    const id = mapFeature.id as number;

    return {
      id,
      kind: layer.kind,
      geometry: mapFeature.geometry,
      properties: mapFeature.properties,
      source: mapFeature.source,
      sourceLayer: mapFeature.sourceLayer,
    }
  }

  public addCache(feature: AppFeature | MapGeoJSONFeature) {
    const asFeature : AppFeature = this.isAppFeature(feature) ? feature : this.asAppFeature(feature);
    this._cache = [...this._cache, asFeature];
  }

  public removeCache(feature: FeatureIdentifier) {
    this._cache = this._cache.filter(f => !fidEquals(f, feature));
  }


  private isAppFeature(feature: AppFeature | MapGeoJSONFeature): feature is AppFeature {
    return 'kind' in feature && 'id' in feature;
  }

  private isLayerKind(kind: string) : kind is LayerKind {
    return !!this.layerConfigService.get(kind as LayerKind);
  }

  public get$(id: FeatureIdentifier) : Observable<AppFeature | undefined> {
    const layer = this.layerConfigService.getBySource(id.source, id.sourceLayer);
    if (!layer) throw new Error(`No layer found for source ${id.source} and layer ${id.sourceLayer}`);

    const cached = this._cache.find(f => fidEquals(f, id));
    if (cached) {
      return of(cached)
    }

    const params = new HttpParams()
      .append("kind", layer.kind)

    // TODO standardize schema location/usage.
    const featureSchema: z.ZodType<AppFeatureDto> = z.strictObject({
      id: z.number(),
      kind: z.string()
        .refine(this.isLayerKind.bind(this), {message: "Invalid layer kind"})
        .transform(k => k as LayerKind),
      geometry: GeoJSONGeometrySchema,
      properties: z.looseObject({}),
    });


    return this.http.get(`api/feature/${id.id}`, {params})
      .pipe(
        map(resp => {
          const parsed = featureSchema.safeParse(resp);
          if (!parsed.success) this.errorService.handleError(
            new Error(`Invalid feature response: ${z.prettifyError(parsed.error)}`, parsed.error)
          )
          return {
            ...parsed.data,
            source: id.source,
            sourceLayer: id.sourceLayer,
          } as AppFeature;
        }),
        catchError((error) => throwError(() => {
          this.errorService.handleError(new Error(`Failed to get feature ${id.id}, ${id.source}`, {cause: error}));
          return error;
        })),
        tap(result => {
          if (result) this.addCache(result)
        })
      );
  }


}