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
import {AreaWatchThumb} from "../area-watch-thumb/area-watch-thumb";

@Component({
  selector: 'app-area-watch-card',
  imports: [
    CardLabel,
    CardThumb,
    MapCard,
    ThumbnailMap,
    RouterLink,
    AreaWatchThumb
  ],
  templateUrl: './area-watch-card.html',
  styleUrl: './area-watch-card.scss'
})
export class AreaWatchCard {
  layerService = inject(LayerConfigService);
  private areaWatchService = inject(AreaWatchService);
  private areaWatchLayerService = inject(AreaWatchLayerService);

  isOdd = input.required<boolean>();
  featureId = computed<FeatureIdentifier>(() => this.areaWatchLayerService.toFeatureIdentifier(this.id()));
  id = input.required<string>();
  data = computed(() => this.areaWatchService.get(this.id()));

  protected readonly RoutePaths = RoutePaths;




}
