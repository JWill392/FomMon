import {Component, computed, effect, inject, input, OnDestroy, OnInit, signal, untracked} from '@angular/core';
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
import {FeatureIdentifier} from "maplibre-gl";
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {MatInput} from "@angular/material/input";
import {CdkTextareaAutosize} from "@angular/cdk/text-field";
import {LoaderComponent} from "../../shared/loader/loader.component";
import {AppFeature} from "../feature.model";
import {MapStateService} from "../../map/map-state.service";
import {fidEquals} from "../../map/map-util";

export const featureDetailTitleResolver: ResolveFn<string> = (route) => {

  const layerConfigService = inject(LayerConfigService);
  const kind = route.params['kind'] as LayerKind;
  const layer = layerConfigService.get(kind);
  if (!layer) {
    // TODO falls back to kind before LayerConfigService is initialized; not reactive
    console.warn('Layer config not available during title resolver - feature-detail');
    return kind;
  }

  return `${layer.featureName}`;
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
    CdkTextareaAutosize,
    LoaderComponent
  ],
  templateUrl: './feature-detail.html',
  styleUrl: './feature-detail.scss'
})
export class FeatureDetail implements OnInit, OnDestroy {
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly mapFeatureService = inject(MapFeatureService);
  private readonly mapStateService = inject(MapStateService);

  kindStringInput = input.required<string>({alias: 'kind'});
  kind = computed(() => this.kindStringInput() as LayerKind);
  idStringInput = input.required<string>({alias: 'id'});
  id = computed(() => parseInt(this.idStringInput()));

  protected layer = computed(() => this.layerConfigService.get(this.kind()));
  protected fid = computed<FeatureIdentifier | undefined>(() => {
    if (!this.layer()) return undefined;
    return {
      source: this.layer()!.source,
      sourceLayer: this.layer()!.sourceLayer,
      id: this.id()
    };
  });

  protected appFeature = signal<AppFeature | undefined>(undefined);


  protected properties = computed(() => {
    const layer = this.layer();
    const properties = this.appFeature()?.properties;
    if (!layer || !properties) return [];

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

    effect((onCleanup) => {
      const fid = this.fid();
      if (!fid) return;

      untracked(() => {
        const loadedFeature = this.appFeature();

        // select
        if (!this.mapStateService.isSelected(fid)) this.mapStateService.select(fid)

        if (fidEquals(loadedFeature, fid)) return; // already loaded

        // load
        this.appFeature.set(undefined);
        const sub = this.mapFeatureService.get$(fid)
          .subscribe({
            next: (feature) => this.appFeature.set(feature)
          })
        onCleanup(() => {
          sub.unsubscribe();
          this.mapFeatureService.removeCache(fid);
        })

      });
    })
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    const feat = this.appFeature();
    if (feat) this.mapFeatureService.removeCache(feat);
  }


  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource().filter = filterValue.trim().toLowerCase();
  }
}
