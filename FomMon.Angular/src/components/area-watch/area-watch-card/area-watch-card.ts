import {
  Component,
  ElementRef,
  inject,
  input,
  ViewChild,
  AfterViewInit,
  DestroyRef,
  OnInit
} from '@angular/core';
import {AreaWatch} from '../area-watch.model';
import {AreaWatchService} from '../area-watch.service';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerService} from '../../layer/layer.service';
import {LocalState} from "../../shared/local-state";

@Component({
  selector: 'app-area-watch-card',
  imports: [],
  templateUrl: './area-watch-card.html',
  styleUrl: './area-watch-card.css'
})
export class AreaWatchCard implements AfterViewInit, OnInit {
  awService = inject(AreaWatchService);
  layerService = inject(LayerService);
  notService = inject(NotificationService);

  data = input.required<AreaWatch>();

  protected readonly LocalState = LocalState;

  @ViewChild('thumb') thumb!: ElementRef<HTMLImageElement>;


  ngOnInit(): void {
  }

  ngAfterViewInit() {
    // TODO generate thumbnails
    // // Ensure the map and DOM elements are ready
    // this.mapService.mapLoaded$.subscribe(() => {
    //   const mapInstance = this.mapService.mapInstance;
    //
    //   if (mapInstance && this.thumb?.nativeElement) {
    //     // Set an ID on the image element for the library to use
    //     const imageId = `map-thumb-${Math.random().toString(36).substr(2, 9)}`;
    //     this.thumb.nativeElement.id = imageId;
    //
    //     toElement(mapInstance, {
    //       targetImageId: imageId,
    //       format: 'png',
    //       hideAllControls: true
    //     }).catch(error => {
    //       console.error('Failed to generate map thumbnail:', error);
    //     });
    //   }
    // });
  }

  delete() {
    this.awService.delete$(this.data())
      .subscribe({
        next: (d) => {
          this.notService.pushMessage(`Watch '${this.data().name}' deleted`);
          },
        error: (e) => {
          console.error('Failed to delete watch', e);
          this.notService.pushMessage(`Failed to delete watch '${this.data().name}'`);
        }
      });
    // no destroyref; component is destroyed when deleted
  }

}
