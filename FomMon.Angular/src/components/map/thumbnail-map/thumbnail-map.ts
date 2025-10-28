import {
  Component,
  computed, effect,
  inject,
  input, output,
  signal
} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent, MapComponent, RasterSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {Map as MapLibreMap} from "maplibre-gl";
import {Geometry} from "geojson";
import {boundingBox} from "../map-util";
import {toPng} from 'html-to-image';
import {ErrorService} from "../../shared/error.service";
import {v4 as uuidv4} from 'uuid';
import {booleanEqual as turfBooleanEqual} from '@turf/boolean-equal'
import {LoaderComponent, LoaderPlaceholderComponent} from "../../shared/loader/loader.component";

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
    RasterSourceComponent,
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
  protected readonly layerIdBase = computed(() => `thumbnail-map-base-${this.instanceId}`)
  protected readonly layerIdFill = computed(() => `thumbnail-map-fill-${this.instanceId}`);
  protected readonly imageId = computed(() => `thumbnail-map-image-${this.instanceId}`);

  private readonly map = signal<MapLibreMap | undefined>(undefined);
  protected readonly mapImgDataUrl = signal<string | undefined>(undefined);
  protected readonly mapImgGeometry = signal<Geometry | undefined>(undefined);

  protected readonly lastImgSrc = signal<string | undefined>(undefined);

  protected readonly instanceId = uuidv4();

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

    toPng(this.map().getContainer(),
      {skipFonts: true})
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