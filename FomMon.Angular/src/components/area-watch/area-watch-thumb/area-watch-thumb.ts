import {Component, computed, DestroyRef, inject, input, linkedSignal} from '@angular/core';
import {MapThumbnailGeneratedEvent, ThumbnailMap} from "../../map/thumbnail-map/thumbnail-map";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AreaWatchService} from "../area-watch.service";
import {ThemeService} from "../../shared/theme.service";
import {ThumbnailUrl} from "../area-watch.model";
import {LoaderComponent} from "../../shared/loader/loader.component";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";

@Component({
  selector: 'app-area-watch-thumb',
  imports: [
    ThumbnailMap,
    LoaderComponent
  ],
  templateUrl: './area-watch-thumb.html'
})
export class AreaWatchThumb {
  protected areaWatchService = inject(AreaWatchService);
  private themeService = inject(ThemeService);
  private destroyRef = inject(DestroyRef);
  private http = inject(HttpClient);

  id = input.required<string>();

  private data = computed(() => this.areaWatchService.get(this.id()));
  protected geometry = computed(() => this.data()?.geometry);
  protected thumbnailUrl = computed<ThumbnailUrl | undefined>(() => this.areaWatchService.getThumbnail(this.id(), this.theme()));

  protected placeholderSrc = computed(() => `assets/areawatch-thumb-placeholder-${this.theme()}.png`);
  protected theme = computed(() => this.themeService.theme());

  protected isThumbnailRequestInProgress = computed(() => false) // TODO get from service; prevent generating thumbnail until definitely needed

  private readonly retryCount = linkedSignal(() => {
    this.thumbnailUrl(); // reset when URL updated
    return 0;
  })

  protected async onThumbMapSaved(event: MapThumbnailGeneratedEvent) {
    const image : Blob = await (await fetch(event.src)).blob()
    this.areaWatchService.uploadThumbnail$(this.id(), event.theme, image, 'thumbnail.png', event.paramHash)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }


  protected onImgLoadError(event: ErrorEvent) {
    const imgElement = event.target as HTMLImageElement;
    const failedSrc = imgElement?.src;
    if (!failedSrc) return;

    this.retryIfExpired(failedSrc);
  }

  private retryIfExpired(url: string) {
    if (this.retryCount() >= 2) return;

    this.ifUrlExpired(url, () => {
      this.retryCount.update(c => c + 1);
      this.areaWatchService.refreshThumbnail(this.id(), this.theme());
    })
  }

  private ifUrlExpired(url: string, action: () => void) {
    this.http.head(url, { observe: "response"})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err: HttpErrorResponse) => {
          switch (err.status) {
            case 403:
              // s3 link expired
              action();
          }
        }
      })
  }
}
