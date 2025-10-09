//import { Point, Feature, FeatureCollection, Geometry } from 'geojson';
import { GeoJSONSource, Map } from 'maplibre-gl';
import { Project, Projects, ProjectState } from '../../types/project';

// Colours
const PROJECT_COLORS = {
  state_commentOpen: '#80D39B',
  state_commentClosed: '#7691BC',
  state_initial: '#FF990A',
  state_published: '#FF990A',
  state_finalized: '#d1d1d1',
  state_expired: '#d1d1d1',
  state_fallback: '#d1d1d1',

  selected: '#FFB347',

  clusterStroke: '#F6E8EA',
  clusterCountText: '#011627',
  clusterCountHalo: '#F6E8EA',
  pointStrokeSelected: '#011627',
  pointStroke: '#F6E8EA',
  pointText: '#011627',
  pointTextHalo: '#F6E8EA',
};

// Convert projects to GeoJSON features
export function AddUpdateProjectSource(projects: Projects, map: Map, sourceId: string) {
    if (!projects) {
      projects = [];
    }

  const features = projects.map(p => ({
    type: 'Feature' as const,
    geometry: p.geometry,
    properties: p,

  }));



  // Add GeoJSON source with clustering enabled
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
      cluster: true,
      clusterRadius: 35,
      clusterMaxZoom: 15,
      clusterProperties: {
        minStateCode: ["min", ["get", "state"]] // numerical value of enum reflects priority
      },
      promoteId: 'id'
    });

  } else {
    const source = map.getSource(sourceId) as GeoJSONSource;
    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }
}

/**
 * Adds a clustered project layer to a MapLibre map instance.
 * @param map The MapLibre map instance
 * @param projects The array of Project objects
 * @param sourceId The id for the GeoJSON source
 * @param clusterLayerId The id for the cluster layer
 * @param pointLayerId The id for the single-point layer
 * @param pointNameLayerId The id for the single-point name layer
 * @param clusterCountLayerId The id for the cluster count label layer
 */
export function addProjectClusterLayer({
  map,
  projects,
  sourceId = 'projects',
  clusterLayerId = 'project-clusters',
  pointLayerId = 'project-points',
  pointNameLayerId = 'project-point-names',
  clusterCountLayerId = 'project-cluster-counts'
}: {
  map: Map;
  projects: Projects;
  sourceId?: string;
  clusterLayerId?: string;
  pointLayerId?: string;
  pointNameLayerId?: string;
  clusterCountLayerId?: string;
}): void {
  AddUpdateProjectSource(projects, map, sourceId);

  // TODO selected increase diameter
  // TODO style hover state
  // Cluster circles
  if (!map.getLayer(clusterLayerId)) {
    map.addLayer({
      id: clusterLayerId,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          "case",
          ["==", ["get", "minStateCode"], ProjectState.commentOpen], PROJECT_COLORS.state_commentOpen,
          ["==", ["get", "minStateCode"], ProjectState.commentClosed], PROJECT_COLORS.state_commentClosed,
          ["==", ["get", "minStateCode"], ProjectState.initial], PROJECT_COLORS.state_initial,
          ["==", ["get", "minStateCode"], ProjectState.published], PROJECT_COLORS.state_published,
          ["==", ["get", "minStateCode"], ProjectState.finalized], PROJECT_COLORS.state_finalized,
          ["==", ["get", "minStateCode"], ProjectState.expired], PROJECT_COLORS.state_expired,
          PROJECT_COLORS.state_fallback
        ],
        'circle-radius': ['*', [
          'interpolate', ["linear"], ['get', 'point_count'],
          1, 12,
          20, 20,
          100, 50
        ],
        [
          'case',
          ['boolean', ['feature-state', 'hover'], false], 1.2,
          1
        ]],
        'circle-stroke-width': ['*', 2, [
          'case',
          ['boolean', ['feature-state', 'hover'], false], 1.25,
          1
        ]],
        'circle-stroke-color': PROJECT_COLORS.clusterStroke,
      }
    });
  }

  // Cluster count labels
  if (!map.getLayer(clusterCountLayerId)) {
    map.addLayer({
      id: clusterCountLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Regular'],
        'text-size': 14,
      },
      paint: {
        'text-color': PROJECT_COLORS.clusterCountText,
        'text-halo-color': PROJECT_COLORS.clusterCountHalo,
        'text-halo-width': 1
      }
    });
  }

  // Single project circles
  if (!map.getLayer(pointLayerId)) {
    map.addLayer({
      id: pointLayerId,
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['*', 8, [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1.4,
          ['boolean', ['feature-state', 'hover'], false], 1.2,
          1
        ]],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], PROJECT_COLORS.selected,
          ['==', ['get', 'stateCode'], ProjectState.commentOpen], PROJECT_COLORS.state_commentOpen,
          ['==', ['get', 'stateCode'], ProjectState.commentClosed], PROJECT_COLORS.state_commentClosed,
          ['==', ['get', 'stateCode'], ProjectState.initial], PROJECT_COLORS.state_initial,
          ['==', ['get', 'stateCode'], ProjectState.published], PROJECT_COLORS.state_published,
          ['==', ['get', 'stateCode'], ProjectState.finalized], PROJECT_COLORS.state_finalized,
          ['==', ['get', 'stateCode'], ProjectState.expired], PROJECT_COLORS.state_expired,
          PROJECT_COLORS.state_fallback
        ],
        'circle-stroke-width': ['*', 2, [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1.4,
          ['boolean', ['feature-state', 'hover'], false], 1.2,
          1
        ]],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], PROJECT_COLORS.pointStrokeSelected,
          PROJECT_COLORS.pointStroke
        ],
      }
    });
  }

  // Single project names
  if (!map.getLayer(pointNameLayerId)) {
    map.addLayer({
      id: pointNameLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      minzoom: 10,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        "text-size": 16,

      },
      paint: {
        'text-color': PROJECT_COLORS.pointText,
        'text-halo-color': PROJECT_COLORS.pointTextHalo,
        'text-halo-width': 2,
        "text-halo-blur": 0.5,
        "text-translate": [0, 20],
      }
    });
  }


}
