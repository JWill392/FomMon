
import { Map } from 'maplibre-gl';

export const PROJECT_FEATURE_COLORS = {
  selectedFill: '#FF9F1C',
  // cutBlockFill: '#A5124D',
  // retentionAreaFill: '#80D39B',
  defaultFill: '#808080',
  selectedLine: '#F58F00',
  alertLine: '#f54a00',
  // roadSectionLine: '#7691BC',
  defaultLine: '#808080',
};

// Adds MapLibre vector tile layers for project features, using feature-state for selection
export function addProjectFeatureLayers({
  map,
  url,
  sourceId,
  sourceLayer,
  featureFillLayer,
  featureLineLayer,
  layerColor,
  featureBorderLayer = featureFillLayer + '_borders',
}: {
  map: Map;
  url: string;
  sourceId: string;
  sourceLayer: string;
  featureFillLayer: string;
  featureLineLayer: string;
  layerColor: string;
  featureBorderLayer?: string;
}) {
  // Add the vector tile source
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'vector',
      tiles: [url],
      minzoom: 3,
      maxzoom: 14,
      attribution: 'Forest Operations Map NRS BC',
      promoteId: 'objectid' // TODO get from configuration
    });
  }


  // Polygons - Fills
  map.addLayer({
    id: featureFillLayer,
    type: 'fill',
    source: sourceId,
    'source-layer': sourceLayer,
    filter: ['in', '$type', 'Polygon'],
    paint: {
      'fill-color': layerColor,
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 1,
        ['boolean', ['feature-state', 'hover'], false], 1,
        0.5
      ],
    }
  });


  // Polygon - borders
  map.addLayer({
    id: featureBorderLayer,
    type: 'line',
    source: sourceId,
    'source-layer': sourceLayer,
    filter: ['in', '$type', 'Polygon'],
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], PROJECT_FEATURE_COLORS.selectedLine,
        ['boolean', ['feature-state', 'alert'], false], PROJECT_FEATURE_COLORS.alertLine,
        PROJECT_FEATURE_COLORS.defaultLine
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 2,
        ['boolean', ['feature-state', 'alert'], false], 2,
        1
      ],
      //'line-dasharray': [2, 0.5],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1,
        ['boolean', ['feature-state', 'selected'], false], 1,
        ['boolean', ['feature-state', 'alert'], false], 1,
        0.4
      ]
    },
    minzoom: 10,
  });

  // Lines
  map.addLayer({
    id: featureLineLayer,
    type: 'line',
    source: sourceId,
    'source-layer': sourceLayer,
    filter: ['in', '$type', 'LineString'],
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], PROJECT_FEATURE_COLORS.selectedLine,
        ['boolean', ['feature-state', 'alert'], false], PROJECT_FEATURE_COLORS.alertLine,
        layerColor
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 4,
        2
      ],
      'line-dasharray': [2, 0.5],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1.0,
        0.8
      ]
    },
    minzoom: 10,
  });

}

