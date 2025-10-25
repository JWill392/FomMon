import {Component, DestroyRef, inject, OnDestroy, OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AreaWatchService} from '../area-watch.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {LayerKind} from "../../layer-type/layer-type.model";
import {MapStateService} from "../../map/map-state.service";
import {Geometry} from "geojson";
import {Router} from "@angular/router";
import {AreaWatchLayerService} from "../../map/layer/area-watch-layer/area-watch-layer.service";

@Component({
  selector: 'app-area-watch-add',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './area-watch-add.component.html',
  styleUrl: './area-watch-add.component.css'
})
export class AreaWatchAddComponent implements OnInit {
  private layerService = inject(LayerConfigService);
  protected layers = this.layerService.data;

  private mapStateService = inject(MapStateService);
  private awService = inject(AreaWatchService);
  private awLayerService = inject(AreaWatchLayerService);
  private notService = inject(NotificationService);
  private router = inject(Router);

  private destroyRef = inject(DestroyRef);

  form = new FormGroup({
    name: new FormControl<string>('', {
      validators: [Validators.required],
    }),
    layers: new FormControl<LayerKind[]>([], {
      validators: [Validators.required],
    }),
    geometry: new FormControl<Geometry | null>(null, {
      validators: [Validators.required],
    }),
  })
  ngOnInit(): void {
    this.startDrawMode();
  }

  private startDrawMode(): void {
    // draw mode ended by disposing subscription on component destroy
    this.mapStateService.startDrawMode()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (geometry) => {
          this.form.patchValue({ geometry });
        }
      });
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {return;}


    const addAw = this.awService.createId({
      name: this.form.value.name,
      layers: this.form.value.layers,
      geometry: this.form.value.geometry,
    });

    this.awService.add$(addAw)
      // do NOT take until destroyed, as we navigate away immediately
      .subscribe({
          next: (result) => {
            this.notService.pushMessage(`Watch '${result.name}' added`);
          },
          error: error => {
            console.error('AreaWatch create error', error);
            this.notService.pushMessage("Failed to add watch.  Please try again.");
          }
      });

    this.awLayerService.select(addAw.id);
    this.router.navigate(['/map/area-watch-list']);
  }
}
