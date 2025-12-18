import type {AppAuthHandler} from '@gravity-ui/expresskit';
import type {RequestHandler} from 'express';
import type {SecuritySchemeObject} from './types';

const securitySchemesRegistry = new WeakMap<
    AppAuthHandler | RequestHandler,
    SecuritySchemeDefinition
>();

export interface SecuritySchemeDefinition {
    name: string;
    scheme: SecuritySchemeObject;
    scopes?: string[];
}

export function registerSecurityScheme(
    handler: AppAuthHandler | RequestHandler,
    definition: SecuritySchemeDefinition,
): void {
    securitySchemesRegistry.set(handler, definition);
}

export function getSecurityScheme(
    handler: AppAuthHandler | RequestHandler,
): SecuritySchemeDefinition | undefined {
    return securitySchemesRegistry.get(handler);
}

export function withSecurityScheme(definition: SecuritySchemeDefinition) {
    return function <T extends AppAuthHandler>(handler: T): T {
        registerSecurityScheme(handler, definition);
        return handler;
    };
}

export function bearerAuth(name = 'bearerAuth', scopes?: string[]) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        },
        scopes,
    });
}

export function apiKeyAuth(
    name = 'apiKey',
    in_: 'header' | 'query' | 'cookie' = 'header',
    paramName = 'X-API-Key',
    scopes?: string[],
) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'apiKey',
            in: in_,
            name: paramName,
        },
        scopes,
    });
}

export function basicAuth(name = 'basicAuth', scopes?: string[]) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'http',
            scheme: 'basic',
        },
        scopes,
    });
}

export function oauth2Auth(
    name = 'oauth2Auth',
    flows: SecuritySchemeObject['flows'],
    scopes?: string[],
) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'oauth2',
            flows,
        },
        scopes,
    });
}

export function oidcAuth(name = 'oidcAuth', openIdConnectUrl: string, scopes?: string[]) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'openIdConnect',
            openIdConnectUrl,
        },
        scopes,
    });
}
