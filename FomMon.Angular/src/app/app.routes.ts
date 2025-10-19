import { Routes } from '@angular/router';
import {HomeComponent} from "../components/home/home";
import {MapComponent} from '../components/ngx-map/map.component';
import {AreaWatchList} from '../components/area-watch/area-watch-list/area-watch-list';
import {AreaWatchAddComponent} from '../components/area-watch/area-watch-add/area-watch-add.component';
import {ForbiddenComponent} from "../components/shared/forbidden/forbidden.component";
import {NotFoundComponent} from "../components/shared/not-found/not-found.component";
import {canActivateAuthRole} from "../guards/auth-role.guard";
import {LayerList} from "../components/ngx-map/layer/layer-list/layer-list";
import {MenuLayout} from "../components/shared/menu-layout/menu-layout";

export const routes: Routes = [
  { path: 'map',
    component: MapComponent,
    children: [
      { path: 'area-watch-list',
        component: AreaWatchList,
        canActivate: [canActivateAuthRole],
        data: {role: 'spa-user'}
      }, // TODO separate roles

      { path: 'area-watch-add',
        component: AreaWatchAddComponent,
        canActivate: [canActivateAuthRole],
        data: {role: 'spa-user'}
      },

      { path: 'layers',
        component: LayerList
      }
    ]
  },
  { path: '',
    component: MenuLayout,
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full'},
      { path: 'home', component: HomeComponent},

      { path: 'forbidden', component: ForbiddenComponent },
      { path: '**', component: NotFoundComponent }
    ]},
];
