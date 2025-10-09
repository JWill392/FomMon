import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {AreaWatchDetail} from '../area-watch-detail/area-watch-detail';
import {AreaWatchCard} from '../area-watch-card/area-watch-card';
import {RouterLink} from '@angular/router';
import {AreaWatchAddComponent} from '../area-watch-add/area-watch-add.component';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-area-watch-list',
  imports: [
    AreaWatchCard,
    RouterLink,
    AreaWatchAddComponent
  ],
  templateUrl: './area-watch-list.html',
  styleUrl: './area-watch-list.css'
})
export class AreaWatchList implements OnInit {
  awService = inject(AreaWatchService);
  notService = inject(NotificationService);
  destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.awService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
