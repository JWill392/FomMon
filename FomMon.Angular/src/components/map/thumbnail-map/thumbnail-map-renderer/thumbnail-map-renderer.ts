import {Component, computed, DestroyRef, effect, inject, OnInit, signal} from '@angular/core';
import {GeoJSONSourceComponent, LayerComponent, MapComponent} from "@maplibre/ngx-maplibre-gl";
import {
  GeneratedThumbnail,
  GenerateThumbnailCommand,
  ThumbnailMapService
} from "../thumbnail-map.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {concatMap, Subject} from "rxjs";
import {boundingBox} from "../../map-util";
import {Map as MapLibreMap, StyleSpecification} from "maplibre-gl";
import {v4 as uuidv4} from "uuid";
import {MapDisplayService} from "../../map-display.service";
import {toPng as htmlToPng} from "html-to-image";
import {ErrorService} from "../../../shared/error.service";
import {Theme, ThemeService} from "../../../shared/theme.service";

type State = 'initializing' | 'idle' | 'map-loading' | 'map-ready' | 'cancel' | 'complete';

@Component({
  selector: 'app-thumbnail-map-renderer',
  imports: [
    GeoJSONSourceComponent,
    LayerComponent,
    MapComponent
  ],
  templateUrl: './thumbnail-map-renderer.html',
  styleUrl: './thumbnail-map-renderer.scss',
  host: {
    '[style.width.px]': 'mapDimensions().width',
    '[style.height.px]': 'mapDimensions().height',
  }
})
export class ThumbnailMapRenderer implements OnInit {
  protected mapDisplayService = inject(MapDisplayService);
  private themeService = inject(ThemeService);
  private thumbnailService = inject(ThumbnailMapService);
  private errorService = inject(ErrorService);
  private destroyRef =  inject(DestroyRef)

  protected command = signal<{request: GenerateThumbnailCommand, response$: Subject<GeneratedThumbnail>} | undefined>(undefined);
  protected commandThemeOrDefault = computed(() => this.command() ? this.command()?.request.theme : this.themeService.theme())

  // STATE
  private readonly state = signal<State>('initializing');

  // MAPLIBRE
  private readonly map = signal<MapLibreMap | undefined>(undefined);
  protected readonly mapDimensions = signal<{width: number, height: number}>({width: 0, height: 0});
  protected readonly bounds = computed(() => {
    const geom = this.command()?.request.geometry;
    if (!geom) return undefined;

    return {
      bbox: boundingBox(geom),
      options: {
        padding: 10,
        duration: 0
      }
    };
  })
  protected readonly instanceId = uuidv4();
  protected thumbnailStyle = computed<StyleSpecification>(() => {
    return this.getThumbnailMapStyle(this.commandThemeOrDefault());
  });

  constructor() {
    // new command
    effect(() => {
      const cmd = this.command();
      const state = this.state();
      // start processing
      if (cmd && state === 'idle') {

        this.setState('map-loading');
      }
    })

    // map dimensions from command
    effect(() => {
      const dims = this.mapDimensions();
      const req = this.command()?.request;
      const map = this.map();
      if (!req || !map) return;

      const changed = req && (dims.width !== req.width || dims.height !== req.height);

      if (changed) {
        this.mapDimensions.set({width: req.width, height: req.height});
        queueMicrotask(() => {
          this.map()?.resize();
          queueMicrotask(() => {
            map.fitBounds(this.bounds().bbox, this.bounds().options)
          })
        })
      }
    })
  }

  ngOnInit(): void {
    // process commands sequentially
    this.thumbnailService.register()
      .pipe(
        takeUntilDestroyed(this.destroyRef),

        // blocks until response$ is complete
        concatMap(({request, response$, cancelled}) => {
          if (cancelled) {
            response$.complete();
            return response$;
          }

          this.command.set({request, response$});
          return response$;
        })
      )
      .subscribe()
  }


  private _cleanupStateFn? : () => void = undefined;
  private setState(state: State) {
    if (this._cleanupStateFn) {
      this._cleanupStateFn();
      this._cleanupStateFn = undefined;
    }

    let nextState: State | undefined = undefined;
    // console.log('TMR', this.instanceId ,': setState', this.state(), '->', state, 'command: ', this.command()?.request.sourceId, this.command()?.request.width)
    switch (state) {
      case 'initializing': break;
      case 'idle': break;
      case 'map-loading':
        const setReadyFn = () => this.setState('map-ready')
        this.map().once('idle', setReadyFn);
        this._cleanupStateFn = () => this.map().off('idle', setReadyFn);
        break;
      case 'map-ready':
        const abortController = new AbortController();
        this.saveMapToImage(abortController.signal);
        this._cleanupStateFn = () => abortController.abort()
        break;
      case 'cancel':
        this.clearCommand();
        nextState = 'idle';
        break;
      case 'complete':
        this.clearCommand();
        nextState = 'idle';
        break;
      default:
        throw new Error(`Unknown state: ${state}`);
    }

    this.state.set(state);
    if (nextState) this.setState(nextState);
  }

  private clearCommand() {
    const rsp = this.command()?.response$;
    this.command.set(undefined);
    if (rsp && !rsp.closed) rsp.complete() // pulls next command
  }

  private saveMapToImage(signal: AbortSignal) {
    this.map().redraw();

    const genCommand = this.command();
    htmlToPng(this.map().getContainer(), {
      style: {
        opacity: "1",
      }
    }).then(dataUri => {
      if (signal.aborted) {
        return;
      }

      if (!dataUri || !dataUri.startsWith('data:image/')) {
        this.errorService.handleError(new Error('Invalid image data URL generated: ' + dataUri));
        return;
      }

      genCommand.response$.next({dataUri})
      this.setState('complete');
    })

    .catch(error => {
      this.errorService.handleError(new Error('Failed to generate map thumbnail', {cause: error}));
      if (!genCommand.response$.closed) genCommand.response$.error(error);
      this.setState('cancel');
    });

  }


  onMapLoad(map: MapLibreMap) {
    map._canvasContextAttributes.preserveDrawingBuffer = true;
    this.map.set(map);
    this.setState('idle');
  }



  private readonly _scaleFactor = 2;
  private getThumbnailMapStyle(theme: Theme) : StyleSpecification {
    const spec = structuredClone(this.mapDisplayService.getStyle(theme)); // Deep clone the main style
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
          layer.layout['text-size'] = 10 * this._scaleFactor;
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
      }

    });

    return spec;
  }
}
