import {Component, computed, DestroyRef, effect, inject, input, OnInit,} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {AreaWatchService} from '../area-watch.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {LayerKind} from "../../layer-type/layer-type.model";
import {DrawCommand, MapStateService} from "../../map/map-state.service";
import {Geometry, Polygon} from "geojson";
import {Router} from "@angular/router";
import {AreaWatchLayerService} from "../../map/layer/area-watch-layer/area-watch-layer.service";
import {ErrorService} from "../../shared/error.service";
import {area as turfAreaM2} from "@turf/area"
import {DecimalPipe} from "@angular/common";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorBinoculars, phosphorPencil, phosphorTrash} from "@ng-icons/phosphor-icons/regular";
import {LocalState} from "../../shared/service/local-state";
import {RoutePaths} from "../../../app/app.routes";
import {Location} from "@angular/common";

type Mode = 'none' | 'add' | 'view' | 'edit';
@Component({
  selector: 'app-area-watch-add',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    NgIcon
  ],
  templateUrl: './area-watch-detail.html',
  styleUrl: './area-watch-detail.scss',
  providers: [provideIcons({phosphorPencil, phosphorTrash, phosphorBinoculars})],
  host: {
    '[class.add-mode]': "mode() === 'add'",
    '[class.edit-mode]': "mode() === 'edit'",
    '[class.view-mode]': "mode() === 'view'",
  }
})
export class AreaWatchDetail implements OnInit {
  private layerService = inject(LayerConfigService);
  private mapStateService = inject(MapStateService);
  private areaWatchService = inject(AreaWatchService);
  private areaWatchLayerService = inject(AreaWatchLayerService);
  private notService = inject(NotificationService);
  private errorService = inject(ErrorService);
  private router = inject(Router);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);

  mode = input.required<Mode>();
  id = input<string>();

  protected data = computed(() => this.id() ? this.areaWatchService.get(this.id()) : undefined);
  protected localState = computed(() => this.data()?.localState ?? 'none')
  private featureId = computed(() => this.id() ? this.areaWatchLayerService.toFeatureIdentifier(this.id()) : undefined);

  protected layers = this.layerService.data;
  protected readonly LocalState = LocalState;

  form = new FormGroup({
    name: new FormControl<string>('', {
      validators: [Validators.required],
    }),
    layers: new FormControl<LayerKind[]>([], {
      validators: [Validators.required],
    }),
    geometry: new FormControl<Geometry | null>(null, {
      validators: [Validators.required, areaValidatorFactory({maxAreaHa: 1000000})],
      // TODO geometry size
    }),
  })

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
  }

  ngOnInit(): void {
    if (this.mode() === 'add') {
      this.onLoadedAdd()

    } else if (this.mode() === 'view' || this.mode() === 'edit') {
      if (!this.id()) {
        this.errorService.handleError(new Error('No id provided'));
        return;
      }
    }
  }

  private onLoadedAdd() {
    this.startDrawMode({
      mode: 'polygon'
    })
  }

  private onLoadedEdit() {
    this.prepop();

    this.startDrawMode({
      id: this.featureId(),
      geometry: this.data().geometry as Polygon,
      mode: 'polygon'
    })

    this.flyToSelf();

    // TODO set draw geometry
  }

  private onLoadedView() {
    this.prepop();
    this.flyToSelf();
    this.mapStateService.select(this.featureId())
  }

  private prepop() {
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
      name: this.form.value.name,
      layers: this.form.value.layers,
      geometry: this.form.value.geometry,
    });

    this.areaWatchService.add$(addDto)
      // no takeUntilDestroyed; we navigate away immediately but need sub to resolve
      .subscribe({
        next: (result) => {
          this.notService.pushMessage(`Watch '${result.name}' added`);
        },
        error: error => {
          console.error('AreaWatch create error', error);
          this.notService.pushMessage("Failed to add watch.  Please try again.");
        }
      });

    this.areaWatchLayerService.select(addDto.id);
    this.router.navigate([RoutePaths.areaWatchView(addDto.id)]);
    return true;
  }


  submitEditMode() : boolean {
    this.form.markAllAsTouched();
    if (this.form.invalid) return false;

    const patchDto = {
      id: this.id()!,
      name: this.form.value.name,
      layers: this.form.value.layers,
      geometry: this.form.value.geometry,
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

    this.router.navigate([RoutePaths.areaWatchView(patchDto.id)]);
    return true;
  }

  protected onEdit(event: PointerEvent) {
    event.stopPropagation();

    this.router.navigate([RoutePaths.areaWatchEdit(this.id()!)]);
  }


  protected onDelete(event: PointerEvent) {
    event.stopPropagation();
    this.delete();
  }

  private delete() {
    const data = this.data()
    this.areaWatchService.delete$(data)
      // no takeUntilDestroyed; we navigate away immediately but need sub to resolve
      .subscribe({
        next: (_) => {
          this.notService.pushMessage(`Watch deleted`);
        },
        error: (e) => {
          console.error('Failed to delete watch', e);
          this.notService.pushMessage(`Failed to delete watch '${data.name}'`);
        }
      });
    this.router.navigate([RoutePaths.areaWatchList]);
  }

  protected onCancelEdit() {
    if (this.mode() === 'add') {
      // TODO generic router back?
      this.location.back();
    } else if (this.mode() === 'edit') {
      this.router.navigate([RoutePaths.areaWatchView(this.id()!)]);
    }
  }


  flyToSelf(): void {
    if (!this.data()) return;
    this.mapStateService.flyTo({
      geometry: this.data().geometry
    })
  }
}

function areaValidatorFactory(options: {maxAreaHa: number}) {
  return (control: FormControl<Geometry | null>): ValidationErrors => {
    if (!control.value) return null;
    const areaHa = turfAreaM2(control.value) / 10000;
    if (areaHa > options.maxAreaHa) {
      return {
        area: {
          valid: false,
          maxAreaHa: options.maxAreaHa,
          actualAreaHa: areaHa
        }
      }
    }
    return null;
  }
}