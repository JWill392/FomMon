import { Injectable } from '@angular/core';
import { map, scan } from 'rxjs/operators';
import {merge, Observable, Subject} from 'rxjs';
import {Snack} from './snack.model';

enum ActionType {
  push = 'push',
  pop = 'pop'
}


type Action = PushAction | PopAction;

interface PushAction  {
  type: ActionType.push;
  payload: Snack;
}

interface PopAction {
  type: ActionType.pop;
}

@Injectable({providedIn: 'root'})
export class NotificationService {
  messages$: Observable<Snack[]>;

  private pushSource = new Subject<Snack>();
  private popSource = new Subject<void>();

  constructor() {
    const push$ = this.pushSource.asObservable()
      .pipe(map((payload) : PushAction => ({ type: ActionType.push, payload })));

    const pop$ = this.popSource.asObservable()
      .pipe(map((payload) : PopAction => ({ type: ActionType.pop })));

    this.messages$ = merge(push$, pop$)
      .pipe(
        scan((acc: Snack[], action : Action) => {
          switch (action.type) {
            case ActionType.push:
              return [...acc, action.payload];
            case ActionType.pop:
              return acc.slice(0, -1);
            default:
              throw new Error('Unknown action type');
          }
        }, [])
      )
  }

  pushMessage(msg: string) {
    this.pushSource.next({
      id: new Date().getTime(),
      text: msg,
    })
  }

  popMessage() {
    this.popSource.next()
  }
}
