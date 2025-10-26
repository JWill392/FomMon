import {
  Component,
  inject,
  input,
  computed, DestroyRef
} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {AreaWatchLayerService} from "../../map/layer/area-watch-layer/area-watch-layer.service";
import {CardLabel, CardThumb} from "../../shared/card/card";
import {MapCard} from "../../map/map-card/map-card";
import {FeatureIdentifier} from "maplibre-gl";
import {ThumbnailMap} from "../../map/thumbnail-map/thumbnail-map";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {RouterLink} from "@angular/router";
import {RoutePaths} from "../../../routes/app.routes";

@Component({
  selector: 'app-area-watch-card',
  imports: [
    CardLabel,
    CardThumb,
    MapCard,
    ThumbnailMap,
    RouterLink
  ],
  templateUrl: './area-watch-card.html',
  styleUrl: './area-watch-card.scss'
})
export class AreaWatchCard {
  layerService = inject(LayerConfigService);
  private areaWatchService = inject(AreaWatchService);
  private areaWatchLayerService = inject(AreaWatchLayerService);
  private destroyRef = inject(DestroyRef);

  isOdd = input.required<boolean>();
  id = input.required<string>();
  featureId = computed<FeatureIdentifier>(() => this.areaWatchLayerService.toFeatureIdentifier(this.id()));
  data = computed(() => this.areaWatchService.get(this.id()));

  protected readonly RoutePaths = RoutePaths;

  protected onThumbMapSaved(image: Blob) {
    this.areaWatchService.uploadThumbnail$(this.id(), image, 'thumbnail.png')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }


}
