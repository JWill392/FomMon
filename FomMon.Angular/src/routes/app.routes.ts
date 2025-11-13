import {Data, Route, Routes} from '@angular/router';
import {HomeComponent} from "../components/home/home";
import {AppMapComponent} from '../components/map/map.component';
import {AreaWatchList} from '../components/area-watch/area-watch-list/area-watch-list';
import {AreaWatchDetail} from '../components/area-watch/area-watch-add/area-watch-detail';
import {ForbiddenComponent} from "../components/shared/forbidden/forbidden.component";
import {NotFoundComponent} from "../components/shared/not-found/not-found.component";
import {canActivateAuthRole} from "../guards/auth-role.guard";
import {LayerList} from "../components/map/layer/layer-list/layer-list";
import {MenuLayout} from "../components/shared/menu-layout/menu-layout";
import {FeatureDetail, featureDetailTitleResolver} from "../components/feature/feature-detail/feature-detail";
import {LayerKind} from "../components/layer-type/layer-type.model";


type PathFunction = (params: any) => string;
export const RoutePaths = {
  map: '/map',
  areaWatchList: '/map/area-watch',
  areaWatchAdd:  '/map/area-watch/add',
  areaWatchEdit: ((params: {id: string}) => `/map/area-watch/${params.id}/edit`),
  areaWatchView: ((params: {id: string}) => `/map/area-watch/${params.id}`),
  featureView: ((params: {kind: LayerKind, id: string}) => `/map/features/${params.kind}/${params.id}`),
  layers: '/map/layers',
  home: '/home',
  forbidden: '/forbidden',
}
// TODO should probably refactor to provide route params separated, not stringified.
//  I think this is making runGuardsAndResolvers: 'always' necessary.


export function getParentRoute(path: string) : string {
  if (!path) return path;
  const currentUrl = path.split('?')[0].split('#')[0];
  const segments = currentUrl.split('/').filter(s => s.length > 0);

  segments.pop();

  return segments.length > 0 ? '/' + segments.join('/') : '/';
}


let map = RoutePaths.map;
export const routes: Routes = [
  { path: asRoute(RoutePaths.map),
    component: AppMapComponent,
    title: "Map",
    children: [
      // authenticated
      {
        path: asRoutePop(RoutePaths.areaWatchList, map),
        component: AreaWatchList,
        title: "Watches",
        ...routeAuth(),
      },
      { path: asRoutePop(RoutePaths.areaWatchAdd, map),
        component: AreaWatchDetail,
        title: "Add Watch",
        ...routeAuth({mode: 'add' as const}),
      },
      { path: asRoutePop(RoutePaths.areaWatchView, map),
        component: AreaWatchDetail,
        title: "Watch",
        ...routeAuth({mode: 'view' as const}),
      },
      { path: asRoutePop(RoutePaths.areaWatchEdit, map),
        component: AreaWatchDetail,
        title: "Watch",
        ...routeAuth({mode: 'edit' as const}),
      },


      // no auth
      { path: asRoutePop(RoutePaths.featureView, map),
        component: FeatureDetail,
        title: featureDetailTitleResolver, // TODO calc to feature-layer name
      },
      { path: asRoutePop(RoutePaths.layers, map),
        component: LayerList,
        title: "Layers",
      },
      { path: '**', redirectTo: '', pathMatch: 'full'},
    ]
  },
  { path: '',
    component: MenuLayout,
    children: [
      { path: '', redirectTo: asRoute(RoutePaths.home), pathMatch: 'full'},
      { path: asRoute(RoutePaths.home), component: HomeComponent},

      { path: asRoute(RoutePaths.forbidden), component: ForbiddenComponent },
      { path: '**', component: NotFoundComponent }
    ]},
];

function routeAuth(data?: Data) : Partial<Route> {
    return {
      canActivate: [canActivateAuthRole],
      data: {role: 'spa-user', ...data},
      runGuardsAndResolvers: 'always'
    }
  }


/** Converts a path or func to an angular route path. */
function asRoute(path: string | Function) : string {
  let ret: string;
  if (typeof path === 'function') {
    const dummyParams = new Proxy({}, {
      get: (_, prop) => `:${String(prop)}`
    });

    ret = (path as PathFunction)(dummyParams);
  } else {
    ret = path;
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


function asRoutePop(path: string | PathFunction, pop: string) : string {
  return popRoot(asRoute(path), pop);
}
