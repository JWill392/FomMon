import {
  Component,
  computed,
  inject,
  input, OnInit, output,
  signal
} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent, MapComponent, RasterSourceComponent} from "@maplibre/ngx-maplibre-gl";
import {Map as MapLibreMap} from "maplibre-gl";
import {Geometry} from "geojson";
import {boundingBox} from "../map-util";
import {toPng} from 'html-to-image';
import {ErrorService} from "../../shared/error.service";
import {v4 as uuidv4} from 'uuid';

/**
 * Generates a map thumbnail image of provided geometry.
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
  ],
  providers: [
  ],
  templateUrl: './thumbnail-map.html',
  styleUrl: './thumbnail-map.css'
})
export class ThumbnailMap implements OnInit {
  private readonly errorService = inject(ErrorService);

  geometry = input.required<Geometry>();
  fillColor = input.required<string>();
  alt = input.required<string>()

  /** Optional image source if already saved; otherwise map will generate */
  imgSrcInput = input<string | undefined>(undefined, {alias: "src"});

  mapSaved = output<Blob>();

  protected readonly state = signal<'idle' | 'image-input' | 'map-loading' | 'map-ready' | 'map-saved-image'>('idle');

  protected readonly bbox = computed(() => this.geometry() ? boundingBox(this.geometry()) : undefined)

  protected readonly sourceId = computed(() => `thumbnail-map-${this.instanceId}`);
  protected readonly layerIdBase = computed(() => `thumbnail-map-base-${this.instanceId}`)
  protected readonly layerIdFill = computed(() => `thumbnail-map-fill-${this.instanceId}`);
  protected readonly imageId = computed(() => `thumbnail-map-image-${this.instanceId}`);

  private readonly map = signal<MapLibreMap | undefined>(undefined);
  protected readonly mapImgDataUrl = signal<string | undefined>(undefined);

  protected readonly instanceId = uuidv4();

  constructor() {
  }
  ngOnInit() {
    if (this.imgSrcInput()) {
      this.state.set('image-input');
    } else {
      this.state.set('map-loading')
    }
  }

  onMapLoad(map: MapLibreMap) {
    this.map.set(map);
    map._canvasContextAttributes.preserveDrawingBuffer = true;

    map.once('idle', () => {
      this.state.set('map-ready');
      this.saveMapToImage();
    });

  }

  private saveMapToImage() {
    this.map().redraw();
    toPng(this.map().getContainer())
      .then(async (dataUrl) => {
        this.state.set('map-saved-image');
        this.mapImgDataUrl.set(dataUrl);

        const blob = await (await fetch(dataUrl)).blob();
        this.mapSaved.emit(blob);
      }).catch(error => {
        this.errorService.handleError(new Error('Failed to generate map thumbnail:', {cause: error}));
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