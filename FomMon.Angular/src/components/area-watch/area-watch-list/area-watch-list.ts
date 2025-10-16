import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {AreaWatchCard} from '../area-watch-card/area-watch-card';
import {RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-area-watch-list',
  imports: [
    AreaWatchCard,
    RouterLink
  ],
  templateUrl: './area-watch-list.html',
  styleUrl: './area-watch-list.css'
})
export class AreaWatchList implements OnInit {
  awService = inject(AreaWatchService);
  destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.awService.initialize$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
