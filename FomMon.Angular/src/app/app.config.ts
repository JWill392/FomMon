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


const urlCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: /^(api)(\/.*)?$/i,
  bearerPrefix: 'Bearer'
});

export const appConfig: ApplicationConfig = {
  providers: [
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
          sessionTimeout: 3_600_000 // 1 hour
        })
      ],
      providers: [AutoRefreshTokenService, UserActivityService, ErrorService],
    }),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [urlCondition]
    },
    provideAppInitializer(() => {
      const configService = inject(AppConfigService);
      return configService.loadConfig();
    }),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    {provide: TitleStrategy, useClass: TemplatePageTitleStrategy},
    provideHttpClient(withInterceptors(
      [includeBearerTokenInterceptor,
      ]
    ))
  ]
};
