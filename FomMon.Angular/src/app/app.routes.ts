import { Routes } from '@angular/router';
import {MapComponent} from "../components/map/map";
import {HomeComponent} from "../components/home/home";
import {NgxMap} from '../components/ngx-map/ngx-map';
import {AreaWatchList} from '../components/area-watch/area-watch-list/area-watch-list';
import {AreaWatchAddComponent} from '../components/area-watch/area-watch-add/area-watch-add.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full'},
  { path: 'home', component: HomeComponent},
  { path: 'map', component: MapComponent},
  { path: 'ngx-map', component: NgxMap },
  { path: 'area-watch-list', component: AreaWatchList}, // TODO auth
  { path: 'area-watch-add', component: AreaWatchAddComponent}
];
