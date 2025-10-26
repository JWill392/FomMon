import {Routes} from '@angular/router';
import {HomeComponent} from "../components/home/home";
import {MapComponent} from '../components/map/map.component';
import {AreaWatchList} from '../components/area-watch/area-watch-list/area-watch-list';
import {AreaWatchDetail} from '../components/area-watch/area-watch-add/area-watch-detail';
import {ForbiddenComponent} from "../components/shared/forbidden/forbidden.component";
import {NotFoundComponent} from "../components/shared/not-found/not-found.component";
import {canActivateAuthRole} from "../guards/auth-role.guard";
import {LayerList} from "../components/map/layer/layer-list/layer-list";
import {MenuLayout} from "../components/shared/menu-layout/menu-layout";


type PathFunction = (params: Record<string, string>) => string;
export const RoutePaths = {
  map: '/map',
  areaWatchList: '/map/area-watch',
  areaWatchAdd:  '/map/area-watch/add',
  areaWatchEdit: ((params: {id: string}) => `/map/area-watch/${params.id}/edit`) as PathFunction,
  areaWatchView: ((params: {id: string}) => `/map/area-watch/${params.id}`) as PathFunction,
  layers: '/map/layers',
  home: '/home',
  forbidden: '/forbidden',
}

export function getParentRoute(path: string) : string {
  if (!path) return path;
  const currentUrl = path.split('?')[0].split('#')[0];
  const segments = currentUrl.split('/').filter(s => s.length > 0);

  segments.pop();

  return segments.length > 0 ? '/' + segments.join('/') : '/';
}


let map = RoutePaths.map;
export const routes: Routes = [
  { path: asDummy(RoutePaths.map),
    component: MapComponent,
    title: "Map",
    children: [
      {
        path: asDummyPop(RoutePaths.areaWatchList, map),
        component: AreaWatchList,
        title: "Watches",
        canActivate: [canActivateAuthRole],
        data: {role: 'spa-user'},
      },
      { path: asDummyPop(RoutePaths.areaWatchAdd, map),
        component: AreaWatchDetail,
        title: "Add Watch",
        canActivate: [canActivateAuthRole],
        data: {role: 'spa-user', mode: 'add' as const}
      },
      { path: asDummyPop(RoutePaths.areaWatchView, map),
        component: AreaWatchDetail,
        title: "Watch",
        canActivate: [canActivateAuthRole],
        data: {role: 'spa-user', mode: 'view' as const},
        runGuardsAndResolvers: 'always'
      },
      { path: asDummyPop(RoutePaths.areaWatchEdit, map),
        component: AreaWatchDetail,
        title: "Watch",
        canActivate: [canActivateAuthRole],
        data: {role: 'spa-user', mode: 'edit' as const},
        runGuardsAndResolvers: 'always'
      },
      { path: asDummyPop(RoutePaths.layers, map),
        // unauthenticated
        component: LayerList,
        title: "Layers",
      }
    ]
  },
  { path: '',
    component: MenuLayout,
    children: [
      { path: '', redirectTo: asDummy(RoutePaths.home), pathMatch: 'full'},
      { path: asDummy(RoutePaths.home), component: HomeComponent},

      { path: asDummy(RoutePaths.forbidden), component: ForbiddenComponent },
      { path: '**', component: NotFoundComponent }
    ]},
];


/** Converts a path or func to an angular route path. */
function asDummy(path: string | PathFunction) : string {
  let ret: string;
  if (typeof path === 'function') {
    const dummyParams = new Proxy({}, {
      get: (_, prop) => `:${String(prop)}`
    });

    ret = (path as PathFunction)(dummyParams);
  } else if (typeof path === 'string') {
    ret = path;
  } else {
    throw new Error('Invalid path');
  }

  if (ret.startsWith('/')) {
    ret = ret.slice(1);
  }
  return ret;
}

/** Removes the root part of path if matches. */
function popRoot(path: string, root: string) : string {
  const rootPart = root?.split('/').pop();
  const parts = path.split('/').filter(s => s.length > 0);
  if (rootPart && parts[0] === rootPart) {
    parts.shift();
  }
  return parts.join('/');
}


function asDummyPop(path: string | PathFunction, pop: string) : string {
  return popRoot(asDummy(path), pop);
}
