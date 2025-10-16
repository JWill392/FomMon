import {Component, inject} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {NotificationService} from './notification.service';

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



