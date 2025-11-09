import {Injectable, ErrorHandler} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorService implements ErrorHandler {
  handleError(error: Error | string, cause?: Error): Error {
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
    // Log the full cause chain
    let currentCause = fullError.cause;
    let depth = 1;
    while (currentCause) {
      console.error(`  ${'  '.repeat(depth)}Caused by:`, currentCause);
      currentCause = currentCause instanceof Error ? currentCause.cause : undefined;
      depth++;
    }

    return fullError;
  }

  warn(s: string, error?: any) {
    console.warn(s, error);
  }
}
