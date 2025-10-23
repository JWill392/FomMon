import {Component, input} from '@angular/core';
import {NgIcon} from "@ng-icons/core";

@Component({
  selector: 'app-card-label',
  template: `<ng-content>card-label</ng-content>`,
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
  }`,
  host: {
    class: 'label-container'
  }
})
export class CardLabel {

}


@Component({
  selector: 'app-card-thumb',
  template: `<ng-content>card-thumb</ng-content>`,
  styles: `:host {
    flex: 0 0 auto;
    width: 64px;
    height: 64px;
    border-radius: 6px;
    object-fit: cover;
    overflow: hidden;
  }`,
  host: {
    class: 'thumb-container'
  }
})
export class CardThumb {

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
    color: transparent;
    transition: color 0.1s ease, background-color 0.1s ease;
  }

  :host-context(app-card:hover) {
    color: #5a6c52;
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
  styleUrl: './card.css',
  host: {
    '[class.item-odd]': 'isOdd()'
  }
})
export class Card {
  isOdd = input.required<boolean>();
}
