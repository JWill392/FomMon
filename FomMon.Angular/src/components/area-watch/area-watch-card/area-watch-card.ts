import {
  Component,
  inject,
  input,
  computed, DestroyRef
} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {LocalState} from "../../shared/service/local-state";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorXCircleFill} from "@ng-icons/phosphor-icons/fill";
import {AreaWatchLayerService} from "../../map/layer/area-watch-layer/area-watch-layer.service";
import {CardAction, CardLabel, CardThumb} from "../../shared/card/card";
import {MapCard} from "../../map/map-card/map-card";
import {FeatureIdentifier} from "maplibre-gl";
import {ThumbnailMap} from "../../map/thumbnail-map/thumbnail-map";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-area-watch-card',
  imports: [
    NgIcon,
    CardAction,
    CardLabel,
    CardThumb,
    MapCard,
    ThumbnailMap
  ],
  templateUrl: './area-watch-card.html',
  styleUrl: './area-watch-card.css',
  providers: [provideIcons({phosphorXCircleFill})]
})
export class AreaWatchCard {
  layerService = inject(LayerConfigService);
  private areaWatchService = inject(AreaWatchService);
  private areaWatchLayerService = inject(AreaWatchLayerService);
  private notService = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  isOdd = input.required<boolean>();
  id = input.required<string>();
  featureId = computed<FeatureIdentifier>(() => this.areaWatchLayerService.toFeatureIdentifier(this.id()));
  data = computed(() => this.areaWatchService.get(this.id()));

  protected readonly LocalState = LocalState;


  delete(event: PointerEvent) {
    event.stopPropagation();
    this.areaWatchService.delete$(this.data())
      .subscribe({
        next: (_) => {
          this.notService.pushMessage(`Watch deleted`);
          },
        error: (e) => {
          console.error('Failed to delete watch', e);
          this.notService.pushMessage(`Failed to delete watch '${this.data().name}'`);
        }
      });
    // no takeuntildestroyed; component is destroyed when deleted, but we want to process delete event here
  }

  protected onThumbMapSaved(image: Blob) {
    this.areaWatchService.uploadThumbnail$(this.id(), image, 'thumbnail.png')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
