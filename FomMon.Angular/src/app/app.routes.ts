import { Routes } from '@angular/router';
import {HomeComponent} from "../components/home/home";
import {MapComponent} from '../components/map/map.component';
import {AreaWatchList} from '../components/area-watch/area-watch-list/area-watch-list';
import {AreaWatchDetail} from '../components/area-watch/area-watch-add/area-watch-detail';
import {ForbiddenComponent} from "../components/shared/forbidden/forbidden.component";
import {NotFoundComponent} from "../components/shared/not-found/not-found.component";
import {canActivateAuthRole} from "../guards/auth-role.guard";
import {LayerList} from "../components/map/layer/layer-list/layer-list";
import {MenuLayout} from "../components/shared/menu-layout/menu-layout";

export const RoutePaths = {
  map: '/map',
  areaWatchList: '/map/area-watch/list',
  areaWatchAdd:  '/map/area-watch/add',
  areaWatchEdit: (id: string) => `/map/area-watch/edit/${id}`,
  areaWatchView: (id: string) => `/map/area-watch/view/${id}`,
  layers: '/map/layers',
  home: '/home',
}
export const routes: Routes = [
  { path: 'map',
    component: MapComponent,
    children: [
      { path: 'area-watch',
        children: [
          { path: 'list',
            component: AreaWatchList,
            canActivate: [canActivateAuthRole],
            data: {role: 'spa-user'}
          }, // TODO separate roles

          { path: 'add',
            component: AreaWatchDetail,
            canActivate: [canActivateAuthRole],
            data: {role: 'spa-user', mode: 'add' as const}
          },
          { path: 'edit/:id',
            component: AreaWatchDetail,
            canActivate: [canActivateAuthRole],
            data: {role: 'spa-user', mode: 'edit' as const},
            runGuardsAndResolvers: 'always'
          },
          { path: 'view/:id',
            component: AreaWatchDetail,
            canActivate: [canActivateAuthRole],
            data: {role: 'spa-user', mode: 'view' as const},
            runGuardsAndResolvers: 'always'
          },
        ]
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
