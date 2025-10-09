//import { Point, Feature, FeatureCollection, Geometry } from 'geojson';
import {GeoJSONSource, Map} from 'maplibre-gl';
import {AreaWatch} from '../area-watch/area-watch.model';


const COLORS = {
  selectedFill: '#FF9F1C',
  areaWatchFill: '#12a5a5',
  selectedLine: '#F58F00',

  text: '#011627',
  halo: '#F6E8EA',
};

// Convert areawatch to GeoJSON features
export function AddUpdateAreaWatchSource(areaWatches: AreaWatch[], map: Map, sourceId: string) {
    if (!areaWatches) {
      areaWatches = [];
    }

  const features = areaWatches.map((aw) => {
    const {geometry, featureId, ...properties} = aw;
    return {
      type: 'Feature' as const,
      id: featureId,
      geometry: geometry,
      properties: {
        properties
      },
    }
  });

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
    });

  } else {
    const source = map.getSource(sourceId) as GeoJSONSource;
    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }
}

export function addAreaWatchLayer({
  map,
  areaWatches,
  sourceId = 'area-watches',
  layerId = 'area-watch',
  nameLayerId = 'area-watch-name',
}: {
  map: Map;
  areaWatches: AreaWatch[];
  sourceId?: string;
  layerId?: string;
  nameLayerId?: string;
}): void {
  AddUpdateAreaWatchSource(areaWatches, map, sourceId);


  // Area watch poly
  if (!map.getLayer(layerId)) {

    // Polygons - Fills
    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], COLORS.selectedFill,
          COLORS.areaWatchFill
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 0.8,
          ['boolean', ['feature-state', 'hover'], false], 0.7,
          0.5
        ],
      }
    });

  }

  // if (!map.getLayer(nameLayerId)) {
  //   map.addLayer({
  //     id: nameLayerId,
  //     type: 'symbol',
  //     source: sourceId,
  //
  //     //minzoom: 10,
  //     layout: {
  //       'text-field': ['get', 'name'],
  //       'text-font': ['Noto Sans Regular'],
  //       "text-size": 16,
  //
  //     },
  //     paint: {
  //       'text-color': COLORS.text,
  //       'text-halo-color': COLORS.halo,
  //       'text-halo-width': 2,
  //       "text-halo-blur": 0.5,
  //       "text-translate": [0, 20],
  //     }
  //   });
  // }


}
