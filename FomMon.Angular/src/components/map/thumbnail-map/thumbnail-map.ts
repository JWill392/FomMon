import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {Geometry} from "geojson";
import {ErrorService} from "../../shared/error.service";
import {Theme, ThemeService} from "../../shared/theme.service";
import {GeneratedThumbnail, GenerateThumbnailCommand, ThumbnailMapService} from "./thumbnail-map.service";
import {Subscription} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";


export interface MapThumbnailGeneratedEvent extends MapThumbnail {}

export interface MapThumbnail {
  src:string,
  paramHash:string,
  theme:Theme
}

/**
 * Generates a map thumbnail image of provided geometry.
 * (just for fun; would probably be better to generate on backend without basemap)
 * Loads MapLibre instance, saves with html-to-image, then swaps map with image element.
 * Optionally cache image externally & pass as src to skip expensive generation on next use.
 * */
@Component({
  selector: 'app-thumbnail-map',
  templateUrl: './thumbnail-map.html',
  styleUrl: './thumbnail-map.scss'
})
export class ThumbnailMap {
  private readonly thumbnailMapService = inject(ThumbnailMapService);
  private readonly errorService = inject(ErrorService);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef =  inject(DestroyRef);

  // INPUTS
  sourceId = input.required<string>();
  geometry = input.required<Geometry>();
  fillColor = input.required<string>();
  alt = input.required<string>();
  placeholderSrc = input.required<string>();
  width = input.required<number>();
  height = input.required<number>();

  geometryHash = computed(() => this.getStableHash(this.geometry()));

  /** Optional image source if already saved; otherwise map will generate */
  imgSrcInput = input<string | undefined>(undefined, {alias: "src"});
  imgParamHashInput = input<string | undefined>(undefined, {alias: "paramHash"});
  imgThemeInput = input.required<Theme>({alias: "theme"});

  // OUTPUT
  generated = output<MapThumbnailGeneratedEvent>();

  // IMAGE CHANNELS
  private inputImg =  computed<MapThumbnail>(() => ({
    src: this.imgSrcInput(),
    paramHash: this.imgParamHashInput(),
    theme: this.imgThemeInput()
  }))
  private lastImg = signal<MapThumbnail | undefined>(undefined);
  private generatedImg = signal<MapThumbnail | undefined>(undefined);

  protected readonly imgChannel = computed<'input' | 'generated' | 'last' | 'placeholder'>(() => {
    if (this.isImageValidForThemeAndGeometry(this.inputImg())) return 'input';
    if (this.isImageValidForThemeAndGeometry(this.generatedImg())) return 'generated';
    if (this.isImageValidForTheme(this.lastImg())) return 'last';
    return 'placeholder';
  });
  protected readonly imgCurrent = computed<MapThumbnail>(() => {
    switch (this.imgChannel()) {
      case 'input': return this.inputImg();
      case 'generated': return this.generatedImg();
      case 'last': return this.lastImg();
      case 'placeholder':
        return {
          src: this.placeholderSrc(),
          paramHash: '',
          theme: this.themeService.theme()
        }
      default:
        throw new Error(`Unknown imgChannel: ${this.imgChannel()}`);
    }
  });
  private isImageValidForThemeAndGeometry(channel?: MapThumbnail) {
    return this.isImageValidForTheme(channel) &&
      channel.paramHash === this.geometryHash();
  }
  private isImageValidForTheme(channel?: MapThumbnail) {
    return channel &&
      channel.src &&
      channel.theme === this.themeService.theme();
  }

  protected readonly error = signal<Error | undefined>(undefined); // TODO use error

  private generateCommand = computed<GenerateThumbnailCommand>(() => ({
    sourceId: this.sourceId(),
    geometry: this.geometry(),
    theme: this.themeService.theme(),
    width: this.width(),
    height: this.height(),
    fillColor: this.fillColor()
  }));
  private generate$? : Subscription


  constructor() {
    // on input set/changed
    let inProgressCommand: GenerateThumbnailCommand | undefined;
    effect(() => {
      const channel = this.imgChannel();
      const command = this.generateCommand();

      const isGenerating = !!inProgressCommand;
      const shouldGenerate = (channel === 'last' || channel === 'placeholder');
      const hasCommandChanged = !ThumbnailMapService.commandEquals(command, inProgressCommand)

      if (isGenerating && (!shouldGenerate || hasCommandChanged)) {
        // cancel in-progress request
        this.generate$?.unsubscribe();
        clearCommand();
      }

      if (!shouldGenerate) return;

      inProgressCommand = command;
      this.generate$ = this.thumbnailMapService.generate(command)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (thumb: GeneratedThumbnail) => {
            const img = {
              src: thumb.dataUri,
              paramHash: this.getStableHash(command.geometry),
              theme: command.theme
            };
            this.generatedImg.set(img);
            this.generated.emit(img);
            clearCommand();
          },
          error: err => {
            this.error.set(err);
            this.errorService.handleError(`Failed to generate thumbnail`, err);
            clearCommand();
          }
        });
    })
    const clearCommand = () => {
      this.generate$ = undefined;
      inProgressCommand = undefined;
    }
  }



  /** Gets a reasonbly stable hash for caching purposes */
  private getStableHash(geom : Geometry) {
    if (!geom) return '';

    const str = JSON.stringify(geom); // assume same property order

    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
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
})()