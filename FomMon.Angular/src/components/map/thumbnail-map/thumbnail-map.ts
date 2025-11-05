import {Component, computed, effect, HostBinding, inject, input, output, signal} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent, MapComponent} from "@maplibre/ngx-maplibre-gl";
import {Map as MapLibreMap} from "maplibre-gl";
import {Geometry} from "geojson";
import {boundingBox} from "../map-util";
import {toPng as htmlToPng} from 'html-to-image';
import {ErrorService} from "../../shared/error.service";
import {v4 as uuidv4} from 'uuid';
import {booleanEqual as turfBooleanEqual} from '@turf/boolean-equal'
import {LoaderComponent, LoaderPlaceholderComponent} from "../../shared/loader/loader.component";
import {MapDisplayService} from "../map-display.service";

type State = 'idle' | 'image-input' | 'map-loading' | 'map-ready' | 'map-saved-image' | 'error';

/**
 * Generates a map thumbnail image of provided geometry.
 * (just for fun; would probably be better to generate on backend without basemap)
 * Loads MapLibre instance, saves with html-to-image, then swaps map with image element.
 * Optionally cache image externally & pass as src to skip expensive generation on next use.
 * */
@Component({
  selector: 'app-thumbnail-map',
  imports: [
    MapComponent,
    GeoJSONSourceComponent,
    LayerComponent,
    LoaderComponent,
    LoaderPlaceholderComponent,
  ],
  providers: [
  ],
  templateUrl: './thumbnail-map.html',
  styleUrl: './thumbnail-map.scss'
})
export class ThumbnailMap {
  private readonly errorService = inject(ErrorService);
  protected readonly mapDisplayService = inject(MapDisplayService);

  geometry = input.required<Geometry>();
  fillColor = input.required<string>();
  alt = input.required<string>()

  /** Optional image source if already saved; otherwise map will generate */
  imgSrcInput = input<string | undefined>(undefined, {alias: "src"});

  mapSaved = output<string>();

  protected readonly state = signal<State>('idle');
  protected readonly error = signal<Error | undefined>(undefined);

  protected readonly bbox = computed(() => this.geometry() ? boundingBox(this.geometry()) : undefined)

  protected readonly sourceId = computed(() => `thumbnail-map-${this.instanceId}`);
  protected readonly layerIdFill = computed(() => `thumbnail-map-fill-${this.instanceId}`);
  protected readonly imageId = computed(() => `thumbnail-map-image-${this.instanceId}`);

  private readonly map = signal<MapLibreMap | undefined>(undefined);
  protected readonly mapImgDataUrl = signal<string | undefined>(undefined);
  protected readonly mapImgGeometry = signal<Geometry | undefined>(undefined);

  protected readonly lastImgSrc = signal<string | undefined>(undefined);

  protected readonly instanceId = uuidv4();

  private _scaleFactor = 2;
  @HostBinding('style.--thumbnail-scale-factor')
  get cssScaleFactor() {return this._scaleFactor;}

  /** Simplified style for thumbnails - shows labels at all zoom levels */
  protected thumbnailStyle = computed(() => {
    const spec = structuredClone(this.mapDisplayService.style()); // Deep clone the main style
    // Remove or minimize zoom-dependent visibility for important layers
    spec.layers.forEach(layer => {
      // Force labels to be visible
      if (layer.id?.includes('label-') || layer.type === 'symbol') {
        // Remove minzoom restrictions
        delete layer.minzoom;

        // Override opacity to always be visible
        if (layer.paint) {
          if ('text-opacity' in layer.paint) {
            layer.paint['text-opacity'] = 1;
          }
          if ('icon-opacity' in layer.paint) {
            layer.paint['icon-opacity'] = 0.8;
          }
          if ('fill-opacity' in layer.paint) {
            layer.paint['fill-opacity'] = 1;
          }
          if ('line-opacity' in layer.paint) {
            layer.paint['line-opacity'] = 1;
          }
        }
      }


      // Scale up text and icon sizes
      if (layer.layout) {

        // Scale text-size
        if ('text-size' in layer.layout) {

          // hide labels that would be clipped by edge of thumbnail
          layer.layout['text-padding'] = 20 * this._scaleFactor;
          const textSize = layer.layout['text-size'];
          if (typeof textSize === 'number') {
            layer.layout['text-size'] = textSize * this._scaleFactor;
          } else {
            layer.layout['text-size'] = 10 * this._scaleFactor;
          }
        }
        // Scale icon-size
        if ('icon-size' in layer.layout) {
          const iconSize = layer.layout['icon-size'];

          // hide icons that would be clipped by edge of thumbnail
          layer.layout['icon-padding'] = 20 * this._scaleFactor;

          if (typeof iconSize === 'number') {
            layer.layout['icon-size'] = iconSize * this._scaleFactor;
          } else {
            layer.layout['icon-size'] = this._scaleFactor;
          }
        }

        // Scale symbol-spacing if present
        if ('symbol-spacing' in layer.layout && typeof layer.layout['symbol-spacing'] === 'number') {
          layer.layout['symbol-spacing'] = layer.layout['symbol-spacing'] * this._scaleFactor;
        }
      }

    });
    return spec;
  });


  constructor() {
    // on input set/changed
    effect(() => {
      const imgSrc = this.imgSrcInput();
      const geometry = this.geometry();
      const imgGeometry = this.mapImgGeometry();

      if (imgSrc) this.lastImgSrc.set(imgSrc);

      if (imgSrc) {
        this.setState('image-input');

      } else if (geometry) {
        if (this.state() === 'idle' || this.state() === 'image-input') {
          this.setState('map-loading');

        } else if (this.state() === 'map-ready') {
          this.setState('map-ready'); // on change regenerate image

        } else if (this.state() === 'map-saved-image') {
          const hasGeometryChanged = geometry && imgGeometry
            && !turfBooleanEqual(geometry, imgGeometry);
          if (hasGeometryChanged) {
            this.setState('map-loading');
          }
        }
      } else {
        this.setState('idle'); // params unset
      }
    });


  }
  private setState(state: State) : boolean {
    const old = this.state();
    if (old === state) return false;

    switch (state) {
      case 'idle':
        break;

      case 'error':
        this.clearMap();
        break;

      case 'image-input':
        this.clearMap();
        break;

      case 'map-loading':
        this.mapImgDataUrl.set(undefined);
        // pass; adds map in template
        break;

      case 'map-ready':
        this.saveMapToImage();
        break;

      case 'map-saved-image':
        this.mapImgGeometry.set(this.geometry());
        this.mapSaved.emit(this.mapImgDataUrl());
        break;

      default:
        throw new Error(`Unknown state: ${state}`);
    }

    this.state.set(state);
    return true;
  }

  private clearMap() {
    this.map.set(undefined);
    if (this.mapImgDataUrl()) {
      this.lastImgSrc.set(this.mapImgDataUrl());
      this.mapImgDataUrl.set(undefined);
    }
  }

  onMapLoad(map: MapLibreMap) {
    this.map.set(map);
    map._canvasContextAttributes.preserveDrawingBuffer = true;
    map.once('idle', () => this.setState('map-ready'));
  }


  private saveMapToImage() {
    this.map().redraw();

    htmlToPng(this.map().getContainer())
      .then(async (dataUrl) => {
          if (!dataUrl || !dataUrl.startsWith('data:image/')) {
            throw new Error('Invalid image data URL generated: ' + dataUrl);
          }
          this.mapImgDataUrl.set(dataUrl);
          this.setState('map-saved-image');
        }
      ).catch(error => {
        this.errorService.handleError(new Error('Failed to generate map thumbnail:', {cause: error}));
        this.setState('error');
        this.error.set(error);
      });

  }
}

/** Polyfill workaround for html-to-image in firefox
 * https://github.com/bubkoo/html-to-image/issues/508
 * */
(function () {
  if (typeof CSSStyleDeclaration !== 'undefined' && !Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'fontFamily')) {
    Object.defineProperty(CSSStyleDeclaration.prototype, 'fontFamily', {
      get: function () {
        return this.getPropertyValue("font-family");
      },
      enumerable: true,
      configurable: true
    });
  }
})();