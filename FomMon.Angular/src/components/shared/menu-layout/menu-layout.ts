import { Component } from '@angular/core';
import {MenuComponent} from "../../menu/menu";
import {RouterOutlet} from "@angular/router";

@Component({
  selector: 'app-menu-layout',
  imports: [
    MenuComponent,
    RouterOutlet
  ],
  template: `
    <app-menu />
    <router-outlet></router-outlet>`,
  styles: ['']
})
export class MenuLayout {

}
