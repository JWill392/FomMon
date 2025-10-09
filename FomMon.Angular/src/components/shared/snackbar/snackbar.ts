import {Component, effect, signal, DestroyRef, inject, computed} from '@angular/core';
import {Subscription, timer} from 'rxjs';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {NotificationService} from './notification.service';
import {Snack} from './snack.model';

@Component({
  selector: 'app-snackbar',
  standalone: true,
  imports: [],
  templateUrl: './snackbar.html',
  styleUrl: './snackbar.css',
})
export class Snackbar {
  private readonly notService = inject(NotificationService);

  messages = toSignal(this.notService.messages$);

  constructor() {

  }


  // Optional manual dismiss (e.g., close button)
  dismiss(): void {
    this.notService.popMessage();
  }


}



