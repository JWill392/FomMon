import {Component, computed, DestroyRef, inject, input} from '@angular/core';
import {ThumbnailMap, MapThumbnailGeneratedEvent} from "../../map/thumbnail-map/thumbnail-map";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AreaWatchService} from "../area-watch.service";
import {ThemeService} from "../../shared/theme.service";
import {ThumbnailUrl} from "../area-watch.model";

@Component({
  selector: 'app-area-watch-thumb',
  imports: [
    ThumbnailMap
  ],
  templateUrl: './area-watch-thumb.html',
  styleUrl: './area-watch-thumb.scss'
})
export class AreaWatchThumb {
  private areaWatchService = inject(AreaWatchService);
  private themeService = inject(ThemeService);
  private destroyRef = inject(DestroyRef);

  id = input.required<string>();

  private data = computed(() => this.areaWatchService.get(this.id()));
  protected geometry = computed(() => this.data()?.geometry);
  protected thumbnail = computed<ThumbnailUrl>(() => this.areaWatchService.getThumbnail(this.id(), this.theme()));

  protected placeholderSrc = computed(() => `assets/areawatch-thumb-placeholder-${this.theme()}.png`);
  protected theme = computed(() => this.themeService.theme());

  protected async onThumbMapSaved(event: MapThumbnailGeneratedEvent) {
    const image : Blob = await (await fetch(event.src)).blob()
    this.areaWatchService.uploadThumbnail$(this.id(), event.theme, image, 'thumbnail.png', event.paramHash)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }



}
