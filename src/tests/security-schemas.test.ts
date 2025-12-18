import type {NextFunction, Request, Response} from 'express';
import {
    apiKeyAuth,
    basicAuth,
    bearerAuth,
    getSecurityScheme,
    oauth2Auth,
    oidcAuth,
    registerSecurityScheme,
    withSecurityScheme,
} from '../security-schemas';

describe('security-schemas', () => {
    describe('bearerAuth', () => {
        it('should register bearer auth scheme with default name', () => {
            const handler = bearerAuth()((_req, _res, next) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('bearerAuth');
            expect(scheme?.scheme.type).toBe('http');
            expect(scheme?.scheme.scheme).toBe('bearer');
            expect(scheme?.scheme.bearerFormat).toBe('JWT');
            expect(scheme?.scopes).toBeUndefined();
        });

        it('should register bearer auth scheme with custom name and scopes', () => {
            const handler = bearerAuth('jwtAuth', ['read:users', 'write:users'])((
                _req,
                _res,
                next,
            ) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('jwtAuth');
            expect(scheme?.scheme.type).toBe('http');
            expect(scheme?.scheme.scheme).toBe('bearer');
            expect(scheme?.scheme.bearerFormat).toBe('JWT');
            expect(scheme?.scopes).toEqual(['read:users', 'write:users']);
        });
    });

    describe('apiKeyAuth', () => {
        it('should register API key auth scheme in header by default', () => {
            const handler = apiKeyAuth()((_req, _res, next) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('apiKey');
            expect(scheme?.scheme.type).toBe('apiKey');
            expect(scheme?.scheme.in).toBe('header');
            expect(scheme?.scheme.name).toBe('X-API-Key');
        });

        it('should register API key auth scheme in query', () => {
            const handler = apiKeyAuth('apiKeyAuth', 'query', 'api_key', ['read'])((
                _req,
                _res,
                next,
            ) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('apiKeyAuth');
            expect(scheme?.scheme.type).toBe('apiKey');
            expect(scheme?.scheme.in).toBe('query');
            expect(scheme?.scheme.name).toBe('api_key');
            expect(scheme?.scopes).toEqual(['read']);
        });

        it('should register API key auth scheme in cookie', () => {
            const handler = apiKeyAuth(
                'cookieAuth',
                'cookie',
                'sessionId',
            )((_req, _res, next) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('cookieAuth');
            expect(scheme?.scheme.type).toBe('apiKey');
            expect(scheme?.scheme.in).toBe('cookie');
            expect(scheme?.scheme.name).toBe('sessionId');
        });
    });

    describe('basicAuth', () => {
        it('should register basic auth scheme with default name', () => {
            const handler = basicAuth()((_req, _res, next) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('basicAuth');
            expect(scheme?.scheme.type).toBe('http');
            expect(scheme?.scheme.scheme).toBe('basic');
        });

        it('should register basic auth scheme with custom name and scopes', () => {
            const handler = basicAuth('myBasicAuth', ['read', 'write'])((_req, _res, next) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('myBasicAuth');
            expect(scheme?.scheme.type).toBe('http');
            expect(scheme?.scheme.scheme).toBe('basic');
            expect(scheme?.scopes).toEqual(['read', 'write']);
        });
    });

    describe('oauth2Auth', () => {
        it('should register OAuth2 auth scheme with implicit flow', () => {
            const flows = {
                implicit: {
                    authorizationUrl: 'https://example.com/oauth/authorize',
                    scopes: {
                        read: 'Read access',
                        write: 'Write access',
                    },
                },
            };

            const handler = oauth2Auth('oauth2Auth', flows, ['read', 'write'])((
                _req,
                _res,
                next,
            ) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('oauth2Auth');
            expect(scheme?.scheme.type).toBe('oauth2');
            expect(scheme?.scheme.flows).toEqual(flows);
            expect(scheme?.scopes).toEqual(['read', 'write']);
        });

        it('should register OAuth2 auth scheme with authorization code flow', () => {
            const flows = {
                authorizationCode: {
                    authorizationUrl: 'https://example.com/oauth/authorize',
                    tokenUrl: 'https://example.com/oauth/token',
                    scopes: {
                        read: 'Read access',
                        write: 'Write access',
                    },
                },
            };

            const handler = oauth2Auth(
                'oauth2Code',
                flows,
            )((_req, _res, next) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('oauth2Code');
            expect(scheme?.scheme.type).toBe('oauth2');
            expect(scheme?.scheme.flows).toEqual(flows);
        });
    });

    describe('oidcAuth', () => {
        it('should register OpenID Connect auth scheme', () => {
            const openIdConnectUrl = 'https://example.com/.well-known/openid-configuration';

            const handler = oidcAuth('oidcAuth', openIdConnectUrl, ['profile', 'email'])((
                _req,
                _res,
                next,
            ) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme?.name).toBe('oidcAuth');
            expect(scheme?.scheme.type).toBe('openIdConnect');
            expect(scheme?.scheme.openIdConnectUrl).toBe(openIdConnectUrl);
            expect(scheme?.scopes).toEqual(['profile', 'email']);
        });
    });

    describe('withSecurityScheme', () => {
        it('should register custom security scheme', () => {
            const customScheme = {
                name: 'customAuth',
                scheme: {
                    type: 'http' as const,
                    scheme: 'digest',
                    description: 'Digest authentication',
                },
                scopes: ['read', 'write'],
            };

            const handler = withSecurityScheme(customScheme)((_req, _res, next) => {
                next();
            });

            const scheme = getSecurityScheme(handler);
            expect(scheme).toBeDefined();
            expect(scheme).toEqual(customScheme);
        });

        it('should return the same handler function', () => {
            const originalHandler = (_req: Request, _res: Response, next: NextFunction) => {
                next();
            };

            const wrappedHandler = withSecurityScheme({
                name: 'test',
                scheme: {type: 'http', scheme: 'bearer'},
            })(originalHandler);

            expect(wrappedHandler).toBe(originalHandler);
        });
    });

    describe('registerSecurityScheme and getSecurityScheme', () => {
        it('should register and retrieve security scheme', () => {
            const handler = (_req: Request, _res: Response, next: NextFunction) => {
                next();
            };

            const definition = {
                name: 'testAuth',
                scheme: {
                    type: 'http' as const,
                    scheme: 'bearer',
                },
                scopes: ['read'],
            };

            registerSecurityScheme(handler, definition);
            const retrieved = getSecurityScheme(handler);

            expect(retrieved).toEqual(definition);
        });

        it('should return undefined for unregistered handler', () => {
            const handler = (_req: Request, _res: Response, next: NextFunction) => {
                next();
            };

            const retrieved = getSecurityScheme(handler);
            expect(retrieved).toBeUndefined();
        });

        it('should handle different handlers independently', () => {
            const handler1 = (_req: Request, _res: Response, next: NextFunction) => {
                next();
            };
            const handler2 = (_req: Request, _res: Response, next: NextFunction) => {
                next();
            };

            const definition1 = {
                name: 'auth1',
                scheme: {type: 'http' as const, scheme: 'bearer'},
            };
            const definition2 = {
                name: 'auth2',
                scheme: {type: 'apiKey' as const, in: 'header' as const, name: 'key'},
            };

            registerSecurityScheme(handler1, definition1);
            registerSecurityScheme(handler2, definition2);

            expect(getSecurityScheme(handler1)).toEqual(definition1);
            expect(getSecurityScheme(handler2)).toEqual(definition2);
        });
    });
});
