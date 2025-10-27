import {Component, computed, DestroyRef, inject, input} from '@angular/core';
import {ThumbnailMap} from "../../map/thumbnail-map/thumbnail-map";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AreaWatchService} from "../area-watch.service";
import {Geometry} from "geojson";

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
  private destroyRef = inject(DestroyRef);

  id = input.required<string>();
  overrideGeometry = input<Geometry>();

  private data = computed(() => this.areaWatchService.get(this.id()));
  protected geometry = computed(() => this.data()?.geometry);
  protected src = computed(() => this.data()?.thumbnailImageUrl);

  protected async onThumbMapSaved(imageUri: string) {
    const image : Blob = await (await fetch(imageUri)).blob()
    this.areaWatchService.uploadThumbnail$(this.id(), image, 'thumbnail.png')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
