import {Component, computed, inject, input} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {CardLabel, CardThumb} from "../../shared/card/card";
import {MapCard} from "../../map/map-card/map-card";
import {FeatureIdentifier} from "maplibre-gl";
import {RouterLink} from "@angular/router";
import {RoutePaths} from "../../../routes/app.routes";
import {AreaWatchThumb} from "../area-watch-thumb/area-watch-thumb";
import {LoaderComponent} from "../../shared/loader/loader.component";

@Component({
  selector: 'app-area-watch-card',
  imports: [
    CardLabel,
    CardThumb,
    MapCard,
    RouterLink,
    AreaWatchThumb,
    LoaderComponent
  ],
  templateUrl: './area-watch-card.html',
  styleUrl: './area-watch-card.scss'
})
export class AreaWatchCard {
  layerService = inject(LayerConfigService);
  protected areaWatchService = inject(AreaWatchService);

  isOdd = input.required<boolean>();
  featureId = computed<FeatureIdentifier | undefined>(() => this.data() ? this.areaWatchService.toFeatureIdentifier(this.data()!) : undefined);
  id = input.required<string>();
  data = computed(() => this.areaWatchService.get(this.id()));

  protected readonly RoutePaths = RoutePaths;




}
