import {Component, input} from '@angular/core';

@Component({
  selector: 'app-card-label',
  template: `<h3 class="label-title">{{title()}}</h3> 
  <ng-content></ng-content>
  `,
  styles: `:host {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;

    font-size: 14px;
    color: #222;
    font-weight: normal;
    overflow: hidden;
  }

  .label-title {
    font-size: 14px;
    font-weight: normal;
    color: #1e351e;

    width: 100%;
    overflow: hidden;
    text-wrap: nowrap;
    text-overflow: ellipsis;
  }
  `,
  host: {
    class: 'label-container'
  }
})
export class CardLabel {
  title = input.required<string>();
}


@Component({
  selector: 'app-card-thumb',
  template: `@if(src()) {
    <img [src]="src()" [alt]="alt()"/>
  } @else {
    <ng-content>card-thumb</ng-content>
  }`,
  styles: `:host {
    flex: 0 0 auto;
    width: 64px;
    height: 64px;
    border-radius: 6px;
    overflow: hidden;
    display: block;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  `,
  host: {
    class: 'thumb-container'
  }
})
export class CardThumb {
  alt = input<string|undefined>(undefined);
  src = input<string|undefined>(undefined);
}

@Component({
  selector: 'app-card-action',
  template: `<ng-content>card-action</ng-content>`,
  styles: `:host {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 20px;
    padding: 0;

    color: var(--card-action-color);
    transition: color 0.1s ease, background-color 0.1s ease;
  }

  `,
  host: {
    class: 'action-item'
  }
})
export class CardAction {

}


@Component({
  selector: 'app-card',
  imports: [],
  templateUrl: './card.html',
  styleUrl: './card.scss',
  host: {
    '[class.item-odd]': 'isOdd()',
  }
})
export class Card {
  isOdd = input.required<boolean>();

}
