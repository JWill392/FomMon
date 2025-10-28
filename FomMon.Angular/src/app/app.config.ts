import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideRouter, TitleStrategy, withComponentInputBinding} from '@angular/router';
import {
  provideKeycloak, withAutoRefreshToken, AutoRefreshTokenService, UserActivityService,
  createInterceptorCondition,
  IncludeBearerTokenCondition,
  includeBearerTokenInterceptor,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG
} from 'keycloak-angular';

import {routes} from '../routes/app.routes';
import {ErrorService} from '../components/shared/error.service';
import {provideAppInitializer, inject} from '@angular/core';
import {AppConfigService} from "../config/app-config.service";
import {TemplatePageTitleStrategy} from "../routes/TemplatePageTitleStrategy";
import {MAT_FORM_FIELD_DEFAULT_OPTIONS} from "@angular/material/form-field";


const urlCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: /^(api)(\/.*)?$/i,
  bearerPrefix: 'Bearer'
});

export const appConfig: ApplicationConfig = {
  providers: [
    // auth
    provideKeycloak({
      config: {
        url: '/keycloak',
        realm: 'fom-mon',
        clientId: 'angular-spa'
      },
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html'
      },
      features: [
        withAutoRefreshToken({
          onInactivityTimeout: 'logout',
          sessionTimeout: 24 * 3_600_000 * 7 // 1 week
        })
      ],
      providers: [AutoRefreshTokenService, UserActivityService, ErrorService],
    }),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [urlCondition]
    },
    provideHttpClient(withInterceptors(
      [includeBearerTokenInterceptor,
      ]
    )),

    // config
    provideAppInitializer(() => {
      const configService = inject(AppConfigService);
      return configService.loadConfig();
    }),

    // routing
    provideRouter(routes, withComponentInputBinding()),
    {provide: TitleStrategy, useClass: TemplatePageTitleStrategy},

    // material theme
    {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {appearance: 'outline'}},

    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
  ]
};
