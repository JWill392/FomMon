import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  LayerComponent,
  MapComponent,
  VectorSourceComponent,
} from '@maplibre/ngx-maplibre-gl';
import type { LayerSpecification } from 'maplibre-gl';
import {AreaWatchList} from '../area-watch/area-watch-list/area-watch-list';

@Component({
  selector: 'app-ngx-map',
  imports: [
    MapComponent,
    LayerComponent,
    VectorSourceComponent,
    AreaWatchList
  ],
  templateUrl: './ngx-map.html',
  styleUrl: './ngx-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxMap {

}
