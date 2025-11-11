import {inject, Injectable} from "@angular/core";
import {RouterStateSnapshot, TitleStrategy} from "@angular/router";
import {AppConfigService} from "../config/app-config.service";
import {Title} from "@angular/platform-browser";

@Injectable({providedIn: 'root'})
export class TemplatePageTitleStrategy extends TitleStrategy {
  private config = inject(AppConfigService);
  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot) {
    const title = this.buildTitle(routerState);

    if (title !== undefined) {
      this.title.setTitle(`${this.config.get().app.title} | ${title}`);
    }
  }
}