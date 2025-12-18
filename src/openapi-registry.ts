import type {OpenApiRegistryConfig, OpenApiSchemaObject, SecuritySchemeObject} from './types';
import {serve, setup} from 'swagger-ui-express';

import {
    AppErrorHandler,
    AppMiddleware,
    AppMountHandler,
    AppRouteDescription,
    AppRouteHandler,
    AppRoutes,
    AuthPolicy,
    RouteContract,
    getContract,
    getErrorContract,
} from '@gravity-ui/expresskit';
import type {RequestHandler} from 'express';
import {z} from 'zod';
import {getSecurityScheme} from './security-schemas';
import {HttpMethod} from './types';
import {NodeKit} from '@gravity-ui/nodekit';

/**
 * Creates an OpenAPI registry that manages routes and security schemes
 * for generating OpenAPI documentation.
 *
 * @param config - Configuration for the OpenAPI registry
 * @returns An object with methods to register routes, security schemes, and generate the OpenAPI schema
 */
export function createOpenApiRegistry(config: OpenApiRegistryConfig) {
    const openApiSchema: OpenApiSchemaObject = {
        openapi: '3.0.3',
        info: {
            title: config.title || 'API Documentation',
            version: config.version || '1.0.0',
            description: config.description || 'Generated API documentation',
        },
        servers: config.servers || [{url: 'http://localhost:3030'}],
        paths: {},
        components: {
            schemas: {},
            securitySchemes: {},
        },
    };

    if (config.contact) {
        openApiSchema.info.contact = config.contact;
    }

    if (config.license) {
        openApiSchema.info.license = config.license;
    }

    function getResponseDescription(statusCode: string): string {
        const descriptions: Record<string, string> = {
            '200': 'Successful response',
            '201': 'Created successfully',
            '204': 'No content',
            '400': 'Bad request',
            '401': 'Unauthorized',
            '403': 'Forbidden',
            '404': 'Not found',
            '422': 'Validation error',
            '500': 'Internal server error',
        };
        return descriptions[statusCode] || 'Response';
    }

    function createParameters(
        paramType: 'query' | 'path' | 'header',
        schema: z.ZodType,
        alwaysRequired = false,
    ): Record<string, unknown>[] {
        const jsonSchema = z.toJSONSchema(schema);
        if (jsonSchema.type !== 'object' || !jsonSchema.properties) return [];

        const required = (jsonSchema.required as string[]) || [];

        return Object.entries(jsonSchema.properties).map(([name, property]) => ({
            name,
            in: paramType,
            required: alwaysRequired || required.includes(name),
            schema: property,
        }));
    }

    function createRequestBody(
        bodySchema: z.ZodType,
        contentTypes: string[] = ['application/json'],
    ): Record<string, unknown> {
        const schema = z.toJSONSchema(bodySchema);
        const content = contentTypes.reduce(
            (acc, type) => {
                acc[type] = {schema};
                return acc;
            },
            {} as Record<string, {schema: unknown}>,
        );

        return {required: true, content};
    }

    function createResponses(responseConfig?: RouteContract['response']): Record<string, unknown> {
        const responses: Record<string, unknown> = {};

        if (!responseConfig) {
            // Default response if none specified
            responses['200'] = {
                description: 'Successful response',
                content: {
                    'application/json': {
                        schema: {type: 'object'},
                    },
                },
            };
            return responses;
        }

        const defaultContentType = responseConfig.contentType || 'application/json';

        Object.entries(responseConfig.content).forEach(([statusCode, responseDef]) => {
            const schema = responseDef instanceof z.ZodType ? responseDef : responseDef.schema;
            const description =
                (responseDef instanceof z.ZodType ? undefined : responseDef.description) ||
                getResponseDescription(statusCode);

            const responseObject: Record<string, unknown> = {
                description,
            };

            // Only add content if there is a schema response
            if (schema) {
                responseObject.content = {
                    [defaultContentType]: {
                        schema: z.toJSONSchema(schema),
                    },
                };
            }

            responses[statusCode] = responseObject;
        });

        return responses;
    }

    /**
     * Returns the OpenAPI schema that has been built incrementally during route registration
     *
     * @returns The OpenAPI schema object
     */
    function getOpenApiSchema(): OpenApiSchemaObject {
        return openApiSchema;
    }

    function registerRoute(
        method: HttpMethod,
        routePath: string,
        routeHandler: AppRouteHandler,
        authHandler?: AppMiddleware | RequestHandler,
    ): void {
        const apiConfig = getContract(routeHandler);
        if (!apiConfig) return;

        const security = [];
        if (authHandler) {
            const securityScheme = getSecurityScheme(authHandler);
            if (securityScheme) {
                registerSecurityScheme(securityScheme.name, securityScheme.scheme);
                security.push({
                    [securityScheme.name]: securityScheme.scopes || [],
                });
            }
        }

        // Convert Express path to OpenAPI path
        const openApiPath = routePath.replace(/\/:([^/]+)/g, '/{$1}');

        const pathItem = openApiSchema.paths[openApiPath] || {};
        const operation: Record<string, unknown> = {
            parameters: [],
            responses: {},
        };

        if ('summary' in apiConfig && apiConfig.summary) {
            operation.summary = apiConfig.summary;
        }
        if ('description' in apiConfig && apiConfig.description) {
            operation.description = apiConfig.description;
        }
        if ('tags' in apiConfig && apiConfig.tags) {
            operation.tags = apiConfig.tags;
        }
        if ('operationId' in apiConfig && apiConfig.operationId) {
            operation.operationId = apiConfig.operationId;
        }

        if (security.length > 0) {
            operation.security = security;
        }

        const parameters = [] as Record<string, unknown>[];

        if (apiConfig.request?.query) {
            parameters.push(...createParameters('query', apiConfig.request.query));
        }

        if (apiConfig.request?.params) {
            parameters.push(...createParameters('path', apiConfig.request.params, true));
        }

        if (apiConfig.request?.headers) {
            parameters.push(...createParameters('header', apiConfig.request.headers));
        }

        operation.parameters = parameters;

        if (['post', 'put', 'patch'].includes(method.toLowerCase()) && apiConfig.request?.body) {
            operation.requestBody = createRequestBody(
                apiConfig.request.body,
                apiConfig.request.contentType,
            );
        }

        operation.responses = createResponses(apiConfig.response);

        pathItem[method.toLowerCase()] = operation;
        openApiSchema.paths[openApiPath] = pathItem;
    }

    function registerSecurityScheme(name: string, scheme: SecuritySchemeObject): void {
        if (openApiSchema.components) {
            if (!openApiSchema.components.securitySchemes) {
                openApiSchema.components.securitySchemes = {};
            }
            openApiSchema.components.securitySchemes[name] = scheme;
        }
    }

    function reset(): void {
        openApiSchema.paths = {};
        if (openApiSchema.components) {
            openApiSchema.components.schemas = {};
            openApiSchema.components.securitySchemes = {};
        }
    }

    function registerErrorHandler(errorHandler: AppErrorHandler): void {
        const errorConfig = getErrorContract(errorHandler);
        if (!errorConfig) return;

        if (!openApiSchema.components) {
            openApiSchema.components = {};
        }

        if (!openApiSchema.components.schemas) {
            openApiSchema.components.schemas = {};
        }

        if (!openApiSchema.components.responses) {
            openApiSchema.components.responses = {};
        }

        const defaultContentType = errorConfig.errors.contentType || 'application/json';

        Object.entries(errorConfig.errors.content).forEach(([statusCode, errorDef]) => {
            let schema: z.ZodType | undefined;
            if (errorDef instanceof z.ZodType) {
                schema = errorDef;
            } else if ('schema' in errorDef && errorDef.schema) {
                schema = errorDef.schema;
            }

            let description: string | undefined;
            if (errorDef instanceof z.ZodType) {
                description = undefined;
            } else if ('description' in errorDef && errorDef.description) {
                description = errorDef.description;
            } else {
                description = getResponseDescription(statusCode);
            }

            let name: string | undefined;
            if (errorDef instanceof z.ZodType) {
                name = undefined;
            } else if ('name' in errorDef && errorDef.name) {
                name = errorDef.name;
            }

            if (schema) {
                const schemaName = name || `Error${statusCode}`;
                if (openApiSchema.components?.schemas) {
                    openApiSchema.components.schemas[schemaName] = z.toJSONSchema(
                        schema as z.ZodType,
                    );
                }

                const responseKey = name || `Error${statusCode}`;
                if (openApiSchema.components?.responses) {
                    (openApiSchema.components.responses as Record<string, unknown>)[responseKey] = {
                        description,
                        content: {
                            [defaultContentType]: {
                                schema: {
                                    $ref: `#/components/schemas/${schemaName}`,
                                },
                            },
                        },
                    };
                }
            }
        });
    }

    function registerRoutes(routes: AppRoutes, {ctx}: NodeKit): AppRoutes {
        const recognizedMethods: readonly HttpMethod[] = [
            'get',
            'post',
            'put',
            'patch',
            'delete',
            'head',
            'options',
        ];

        Object.entries(routes).forEach(([path, handlerOrDescription]) => {
            const [rawMethod, ...rawPathParts] = path.trim().split(/\s+/);
            if (!rawMethod || rawPathParts.length === 0) {
                return;
            }

            const methodLower = rawMethod.toLowerCase();
            if (!recognizedMethods.includes(methodLower as HttpMethod)) {
                return;
            }

            const routePath = rawPathParts.join(' ');
            const description: AppRouteDescription =
                typeof handlerOrDescription === 'function'
                    ? {handler: handlerOrDescription}
                    : handlerOrDescription;

            const routeAuthPolicy =
                description.authPolicy ||
                (ctx?.config && 'appAuthPolicy' in ctx.config
                    ? ctx.config.appAuthPolicy
                    : undefined) ||
                `${AuthPolicy.disabled}`;

            const authHandler =
                routeAuthPolicy === AuthPolicy.disabled
                    ? undefined
                    : description.authHandler ||
                      (ctx?.config && 'appAuthHandler' in ctx.config
                          ? ctx.config.appAuthHandler
                          : undefined);

            registerRoute(methodLower as HttpMethod, routePath, description.handler, authHandler);
        });

        const mountPath = config.path ?? '/api/docs';
        const options = config.swaggerUi;
        const swaggerJsonPath = config.swaggerJsonPath;

        return {
            ...routes,
            [`MOUNT ${mountPath}`]: {
                handler: ({router}: Parameters<AppMountHandler>[0]) => {
                    if (swaggerJsonPath) {
                        router.get(swaggerJsonPath, (_req, res) => {
                            res.json(getOpenApiSchema());
                        });

                        const relativePath = swaggerJsonPath.startsWith('/')
                            ? swaggerJsonPath.slice(1)
                            : swaggerJsonPath;

                        const asyncOptions = {
                            ...options,
                            swaggerOptions: {
                                ...options?.swaggerOptions,
                                url: relativePath,
                            },
                        };

                        router.use('/', serve, setup(null, asyncOptions));
                    } else {
                        router.use('/', serve, setup(getOpenApiSchema(), options));
                    }
                },
            },
        };
    }

    return {
        registerSecurityScheme,

        getOpenApiSchema,

        reset,

        registerErrorHandler,

        registerRoutes,
    };
}

export type OpenApiRegistry = ReturnType<typeof createOpenApiRegistry>;
