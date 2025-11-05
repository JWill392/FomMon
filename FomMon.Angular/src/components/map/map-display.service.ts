import {computed, Injectable} from "@angular/core";
import {colorful} from "@versatiles/style";
import {FillLayerSpecification, VectorSourceSpecification} from "@maplibre/maplibre-gl-style-spec";

@Injectable({providedIn: 'root'})
export class MapDisplayService {
  style = computed(() => {
    const spec = colorful({
      // language: "en",
      tiles: [`local://./tileserver/osm_tile/{z}/{x}/{y}`],
      glyphs: "local://./assets/glyphs/{fontstack}/{range}.pbf",
      sprite: [
        {
          "id": "basics",
          "url": "local://./assets/sprites/basics/sprites"
        },
        {
          "id": "markers",
          "url": "local://./assets/sprites/markers/sprites"
        }
      ]
  });

    const source = spec.sources['versatiles-shortbread'] as VectorSourceSpecification;
    source.maxzoom = 18;

    const forest = spec.layers.find(l => l.id === 'land-forest' && l.type === 'fill') as FillLayerSpecification;
    if (forest && forest.paint) {
      forest.paint["fill-opacity"] = [
        "interpolate",
        ["linear"],
        ["zoom"],
        6, 0, // visible at lower zooms
        7, 0.2
      ]
    }

    return spec;
  });



  // Problem: MapLibre disallows relative URLs, but they are required for proxy (angular in dev, docker-nginx in prod)
  // Workaround: use local://. prefix in MapLibre config and rewrite with transformRequest
  // Usage: use tile/sprite/glyph URLs like "local://./tileserver/project_features.1/{z}/{x}/{y}"
  transformLocalUrl = (url: string) => {
    if (/^local:\/\//.test(url)) {
      const protocol = window.location.protocol;
      const host = window.location.host;

      const strippedUrl = url.substr('local://'.length);

      const ret = new URL(protocol + '//' + host + '/' + strippedUrl).href;
      return {url: ret};
    }
    return { url };
  };
}