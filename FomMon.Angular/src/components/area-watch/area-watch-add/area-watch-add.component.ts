import {Component, DestroyRef, inject} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AreaWatchService} from '../area-watch.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {LayerKind} from "../../layer-type/layer-type.model";

@Component({
  selector: 'app-area-watch-add',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './area-watch-add.component.html',
  styleUrl: './area-watch-add.component.css'
})
export class AreaWatchAddComponent {
  layerService = inject(LayerConfigService);

  form = new FormGroup({
    name: new FormControl<string>('', {
      validators: [Validators.required],
    }),
    layers: new FormControl<LayerKind[]>([], {
      validators: [Validators.required],
    }),
  })

  awService = inject(AreaWatchService);
  private destroyRef = inject(DestroyRef);
  notService = inject(NotificationService);


  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {return;}
    const addAw = this.awService.createId({
      name: this.form.value.name,
      layers: this.form.value.layers,
      geometry: {
        type: 'Point',
        coordinates: [0, 0] // TODO get geom from map
      },
    });
    this.awService.add$(addAw)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
          next: (result) => {
            this.notService.pushMessage(`Watch '${result.name}' added`);
            // TODO navigate back to list
          },
          error: error => {
            console.error('AreaWatch create error', error);
            this.notService.pushMessage("Failed to add watch.  Please try again.");
          }
      });
    this.form.reset();
  }
}
