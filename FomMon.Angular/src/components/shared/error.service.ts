import {Injectable, ErrorHandler} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorService implements ErrorHandler {
  handleError(error: any): void {
    console.error('ErrorService:', error); // TODO add error handling
  }

  warn(s: string) {
    console.warn(s);
  }
}
