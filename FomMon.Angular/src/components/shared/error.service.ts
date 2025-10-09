import {Injectable, ErrorHandler, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorService implements ErrorHandler {
  handleError(error: any): void {
    console.error('ErrorService:');
    console.error(error); // TODO add error handling
  }
}
