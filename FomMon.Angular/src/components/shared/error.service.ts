import {Injectable, ErrorHandler} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorService implements ErrorHandler {
  handleError(error: Error | string, cause?: Error): void {
    let fullError : Error
    if (error instanceof Error) {
      fullError = error;
    } else if (typeof error === 'string') {
      fullError = new Error(error);
    } else {
      fullError = new Error('Unknown error');
    }

    if (cause) {
      fullError.cause = cause;
    }

    console.error('ErrorService:', fullError); // TODO add error handling
  }

  warn(s: string, error?: any) {
    console.warn(s, error);
  }
}
