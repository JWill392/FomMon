import {Component, computed, DestroyRef, effect, inject, input, OnInit, Signal,} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {AreaWatchService} from '../area-watch.service';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {LayerKind} from "../../layer-type/layer-type.model";
import {DrawCommand, MapStateService} from "../../map/map-state.service";
import {Geometry, Polygon} from "geojson";
import {Router} from "@angular/router";
import {ErrorService} from "../../shared/error.service";
import {area as turfAreaM2} from "@turf/area"
import {DecimalPipe, Location} from "@angular/common";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorBinoculars, phosphorPencil, phosphorTrash} from "@ng-icons/phosphor-icons/regular";
import {LocalState} from "../../shared/service/local-state";
import {RoutePaths} from "../../../routes/app.routes";
import {MatError, MatFormField, MatLabel} from "@angular/material/select";
import {MatInput} from "@angular/material/input";
import {MatChip, MatChipListbox, MatChipOption, MatChipSet} from "@angular/material/chips";
import {MatButton, MatIconButton} from "@angular/material/button";
import {MatActionList, MatListItem} from "@angular/material/list";
import {LoaderComponent} from "../../shared/loader/loader.component";
import {MapLayerService} from "../../map/layer/map-layer.service";

type Mode = 'none' | 'add' | 'view' | 'edit';
@Component({
  selector: 'app-area-watch-add',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    NgIcon,
    MatInput,
    MatFormField,
    MatChipListbox,
    MatChipOption,
    MatLabel,
    MatChipSet,
    MatChip,
    MatButton,
    MatIconButton,
    MatActionList,
    MatListItem,
    MatError,
    LoaderComponent
  ],
  templateUrl: './area-watch-detail.html',
  styleUrl: './area-watch-detail.scss',
  providers: [provideIcons({phosphorPencil, phosphorTrash, phosphorBinoculars})],
  host: {
  }
})
export class AreaWatchDetail implements OnInit {
  protected layerService = inject(LayerConfigService);
  protected areaWatchService = inject(AreaWatchService);
  private mapStateService = inject(MapStateService);
  private mapLayerService = inject(MapLayerService);
  private notService = inject(NotificationService);
  private errorService = inject(ErrorService);
  private router = inject(Router);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);

  mode = input.required<Mode>();
  id = input<string>();

  protected data = computed(() => this.id() ? this.areaWatchService.get(this.id()!) : undefined);
  protected localState = computed(() => this.data()?.localState ?? 'none')
  private featureId = computed(() => this.id() ? this.areaWatchService.toFeatureIdentifier(this.data()!) : undefined);

  private readonly layerVisSnapshot = 'AreaWatchDetail' as const

  form = new FormGroup({
    name: new FormControl<string>('', {
      validators: [Validators.required],
    }),
    layers: new FormControl<LayerKind[]>([], {
      validators: [Validators.required],
    }),
    geometry: new FormControl<Geometry | null>(null, {
      validators: [Validators.required, areaValidatorFactory({maxAreaHa: 1000000})],
    }),
  })

  private formLayersSignal = toSignal(this.form.controls.layers.valueChanges, {
    initialValue: []
  });
  protected currentLayers: Signal<LayerKind[]> = computed(() =>
    this.mode() === 'view'
      ? (this.data()?.layers ?? [])
      : (this.formLayersSignal() ?? [])
  );

  constructor() {
    effect(() => {
      const data = this.data();
      if (!data) return;

      if (this.mode() === 'edit') {
        this.onLoadedEdit();
      } else if (this.mode() === 'view') {
        this.onLoadedView();
      }
    })

    effect(() => {
      this.currentLayers();
      this.syncLayerVisibility();
    })

  }

  ngOnInit(): void {
    this.mapLayerService.pushVisibilitySnapshot(this.layerVisSnapshot);
    this.mapLayerService.setVisibility(this.areaWatchService.groupId, true, this.layerVisSnapshot);
    this.destroyRef.onDestroy(() => this.mapLayerService.popVisibilitySnapshot(this.layerVisSnapshot));


    if (this.mode() === 'add') {
      this.onLoadedAdd()

    } else if (this.mode() === 'view' || this.mode() === 'edit') {
      if (!this.id()) {
        this.errorService.handleError(new Error('No id provided'));
        return;
      }
    }
  }

  private syncLayerVisibility() {
    const currentLayers = this.currentLayers();

    const visibility = this.mapLayerService.featureGroups()
      .map(g => ({id:g.id, kind:this.layerService.getByGroupId(g.id)?.kind}))
      .filter(gk => !!gk.kind)
      .map(gk => [gk.id, currentLayers.includes(gk.kind)] as [string, boolean]);
    const visMap = new Map<string, boolean>(visibility);

    this.mapLayerService.setVisibilityMany(visMap, this.layerVisSnapshot)
  }


  private onLoadedAdd() {

    this.startDrawMode({
      mode: 'polygon'
    })
  }

  private onLoadedEdit() {
    this.prepopForm();

    this.startDrawMode({
      id: this.featureId(),
      geometry: this.data()!.geometry as Polygon,
      mode: 'polygon'
    })

    this.flyToSelf();
  }

  private onLoadedView() {
    this.flyToSelf();
    this.mapStateService.select(this.featureId()!);
  }

  private prepopForm() {
    const data = this.data();
    if (!data) return;

    this.form.patchValue({
      name: data.name,
      layers: data.layers,
      geometry: data.geometry
    })
  }


  private startDrawMode(command: DrawCommand): void {
    // draw mode ended by disposing subscription on component destroy
    this.mapStateService.startDrawMode(command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (geometry) => {
          this.form.patchValue({ geometry });
        }
      });
  }

  onSubmit() {
    if (this.mode() === 'add') {
      this.submitAddMode()
    } else if (this.mode() === 'edit') {
      this.submitEditMode()
    }
  }

  submitAddMode() : boolean {
    this.form.markAllAsTouched();
    if (this.form.invalid) return false;

    const addDto = this.areaWatchService.createId({
      name: this.form.value.name!,
      layers: this.form.value.layers!,
      geometry: this.form.value.geometry!,
    });

    this.areaWatchService.add$(addDto)
      // no takeUntilDestroyed; we navigate away immediately but need sub to resolve
      .subscribe({
        next: (result) => {
          this.notService.pushMessage(`Watch '${result.name}' added`);
        },
        error: error => {
          this.errorService.handleError('AreaWatch create error', error);
          this.notService.pushMessage("Failed to add watch.  Please try again.");
        }
      });

    const aw = this.areaWatchService.get(addDto.id);
    if (aw) {
      const fid = this.areaWatchService.toFeatureIdentifier(aw); // after add, fid is available
      this.mapStateService.select(fid);
      this.router.navigate([RoutePaths.areaWatchView({id: addDto.id})], {preserveFragment: true});
    }
    return true;
  }


  submitEditMode() : boolean {
    this.form.markAllAsTouched();
    if (this.form.invalid) return false;

    const patchDto = {
      id: this.id()!,
      name: this.form.value.name ?? undefined,
      layers: this.form.value.layers ?? undefined,
      geometry: this.form.value.geometry ?? undefined,
    };

    this.areaWatchService.patch$(patchDto)
      // no takeUntilDestroyed; we navigate away immediately but need sub to resolve
      .subscribe({
        next: (_) => {
          this.notService.pushMessage(`Watch '${patchDto.name}' edited`);
        },
        error: error => {
          this.errorService.handleError(new Error('Failed to edit area watch.',{cause: error}));
        }
      });

    this.router.navigate([RoutePaths.areaWatchView({id: patchDto.id})], {preserveFragment: true});
    return true;
  }


  protected navigateEdit(event: PointerEvent) {
    event.stopPropagation();

    if (this.localState() !== LocalState.added) return;
    this.router.navigate([RoutePaths.areaWatchEdit({id: this.id()!})], {preserveFragment: true});
  }


  protected navigateDelete(event: PointerEvent) {
    event.stopPropagation();

    this.delete();
  }

  private delete() {
    const data = this.data()
    if (!data) return;
    if (this.localState() !== LocalState.added) return;

    this.areaWatchService.delete$(data)
      // no takeUntilDestroyed; we navigate away immediately but need sub to resolve
      .subscribe({
        next: (_) => {
          this.notService.pushMessage(`Watch deleted`);
        },
        error: (e) => {
          this.errorService.handleError('Failed to delete watch', e);
          this.notService.pushMessage(`Failed to delete watch '${data.name}'`);
        }
      });
    this.router.navigate([RoutePaths.areaWatchList], {preserveFragment: true});
  }

  protected onCancelEdit() {
    if (this.mode() === 'add') {
      // TODO generic router back?
      this.location.back();
    } else if (this.mode() === 'edit') {
      this.router.navigate([RoutePaths.areaWatchView({id: this.id()!})], {preserveFragment: true});
    }
  }


  flyToSelf(): void {
    if (!this.data()) return;
    this.mapStateService.flyTo({
      geometry: this.data()!.geometry
    })
  }
}

function areaValidatorFactory(options: {maxAreaHa: number}) {
  const M2_IN_HA = 10000 as const;

  return (control: FormControl<Geometry | null>): ValidationErrors => {
    if (!control.value) return {};
    const areaHa = turfAreaM2(control.value) / M2_IN_HA;
    if (areaHa > options.maxAreaHa) {
      return {
        area: {
          valid: false,
          maxAreaHa: options.maxAreaHa,
          actualAreaHa: areaHa
        }
      }
    }
    return {};
  }
}