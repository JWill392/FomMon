import {Component, computed, effect, inject, input, OnDestroy, OnInit} from '@angular/core';
import {LayerKind} from "../../layer-type/layer-type.model";
import {LayerConfigService} from "../../layer-type/layer-config.service";
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatNoDataRow,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource
} from "@angular/material/table";
import {ResolveFn} from "@angular/router";
import {MapFeatureService} from "../map-feature.service";
import {MapStateService} from "../../map/map-state.service";
import {FeatureIdentifier} from "maplibre-gl";
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {MatInput} from "@angular/material/input";
import {CdkTextareaAutosize} from "@angular/cdk/text-field";

export const featureDetailTitleResolver: ResolveFn<string> = (route) => {
  const layerConfigService = inject(LayerConfigService);
  const kind = route.params['kind'] as LayerKind;
  // TODO falls back to kind before LayerConfigService is initialized; not reactive

  return `${layerConfigService.get(kind)?.featureName ?? kind}`;
}

@Component({
  selector: 'app-feature-detail',
  imports: [
    MatTable,
    MatColumnDef,
    MatCell,
    MatCellDef,
    MatRow,
    MatRowDef,
    MatFormField,
    MatLabel,
    MatInput,
    MatNoDataRow,
    CdkTextareaAutosize
  ],
  templateUrl: './feature-detail.html',
  styleUrl: './feature-detail.scss'
})
export class FeatureDetail implements OnInit, OnDestroy {
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly mapFeatureService = inject(MapFeatureService);
  private readonly mapStateService = inject(MapStateService);

  kind = input.required<LayerKind>();
  idStringInput = input.required<string>({alias: 'id'});
  id = computed(() => {
    const idString = this.idStringInput();
    if (typeof idString === 'number') return idString;
    return parseInt(idString);
  });

  protected layer = computed(() => this.layerConfigService.get(this.kind()));
  protected fid = computed<FeatureIdentifier>(() => {
    if (!this.layer()) return undefined;
    return {
      source: this.layer().source,
      sourceLayer: this.layer().sourceLayer,
      id: this.id()
    };
  });
  protected appFeature = computed(() => this.mapFeatureService.get(this.fid()))

  protected properties = computed(() => {
    const layer = this.layer();
    const properties = this.appFeature()?.properties;
    if (!properties) return [];

    const configCols = layer.columns.map(c => ({
      ...c,
      decode: c.decode && c.decode !== '' ? c.decode : c.name,
      value: properties?.[c.name] ?? ''
    }));

    const nonConfigCols = Object.entries(properties)
      .filter(([key, value]) => configCols.every(c => c.name !== key))
      .map(([key, value]) => ({
        name: key,
        decode: key,
        visibility: 'visible',
        value
      }));

    return [...configCols, ...nonConfigCols];
  });
  protected dataSource = computed(() => new MatTableDataSource(
    this.properties().filter(c => c.visibility === 'visible')));

  constructor() {

    effect(() => {
      const fid = this.fid();
      if (!fid) return;

      this.mapStateService.select(fid);
    })
  }

  ngOnInit(): void {
    // TODO get geometry and properties from service if not set

    if (!this.appFeature()) {
      console.error('Feature not cached; retrieval not implemented');
    }
  }

  ngOnDestroy() {
    this.mapFeatureService.removeCache(this.appFeature());
  }


  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource().filter = filterValue.trim().toLowerCase();
  }
}
