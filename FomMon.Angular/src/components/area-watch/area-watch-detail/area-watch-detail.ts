import { Component, input } from '@angular/core';
import {AreaWatch} from '../area-watch.model';

@Component({
  selector: 'app-area-watch-detail',
  imports: [],
  templateUrl: './area-watch-detail.html',
  styleUrl: './area-watch-detail.css'
})
export class AreaWatchDetail {
  data = input.required<AreaWatch>();
}
