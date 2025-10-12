import type {OpenApiRegistryConfig, OpenApiSchemaObject, SecuritySchemeObject} from './types';
import * as swaggerUi from 'swagger-ui-express';

import {
    RouteContract,
    AppErrorHandler,
    AppMiddleware,
    AppRouteDescription,
    AppRouteHandler,
    AppRoutes,
} from '@gravity-ui/expresskit';
import {z} from 'zod';
import {getErrorContract, getContract} from '@gravity-ui/expresskit';
import {getSecurityScheme} from './security-schemas';
import {HttpMethod} from './types';
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

    // Helper function to create parameters for an operation
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

    // Helper function to create a request body
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

    // Helper function to create responses
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
        authHandler?: AppMiddleware,
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
            summary: apiConfig.summary,
            description: apiConfig.description,
            tags: apiConfig.tags,
            parameters: [],
            responses: {},
        };

        if (apiConfig.operationId) {
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

        if (
            ['post', 'put', 'patch'].includes(method.toLowerCase()) &&
            apiConfig.request?.body
        ) {
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

    return {
        registerRoute,

        registerSecurityScheme,

        getOpenApiSchema,
       

        reset(): void {
            openApiSchema.paths = {};
            if (openApiSchema.components) {
                openApiSchema.components.schemas = {};
                openApiSchema.components.securitySchemes = {};
            }
        },

        registerRoutes(routes: AppRoutes): AppRoutes {
            const recognizedMethods: readonly HttpMethod[] = [
                'get',
                'post',
                'put',
                'patch',
                'delete',
                'head',
                'options',
            ];

            const buildOpenApiSchema = () => {
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

                    registerRoute(
                        methodLower as HttpMethod,
                        routePath,
                        description.handler,
                        description.authHandler,
                    );
                });
            };

            queueMicrotask(buildOpenApiSchema);

            return {
                ...routes,
                'MOUNT /api/docs': {
                    handler: ({router}) => {
                        router.use('/', swaggerUi.serve, swaggerUi.setup(getOpenApiSchema()));
                    },
                },
            };
        },

        registerErrorHandler(errorHandler: AppErrorHandler): void {
            const errorConfig = getErrorContract(errorHandler);
            if (!errorConfig) return;

            // Ensure components and schemas exist
            if (!openApiSchema.components) {
                openApiSchema.components = {};
            }

            if (!openApiSchema.components.schemas) {
                openApiSchema.components.schemas = {};
            }

            // Ensure responses exist
            if (!openApiSchema.components.responses) {
                openApiSchema.components.responses = {};
            }

            const defaultContentType = errorConfig.errors.contentType || 'application/json';

            // Add each error schema to components
            Object.entries(errorConfig.errors.content).forEach(([statusCode, errorDef]) => {
                const schema = errorDef instanceof z.ZodType ? errorDef : errorDef.schema;
                const description =
                    (errorDef instanceof z.ZodType ? undefined : errorDef.description) ||
                    getResponseDescription(statusCode);
                const name = errorDef instanceof z.ZodType ? undefined : errorDef.name;

                if (schema) {
                    const schemaName = name || `Error${statusCode}`;
                    if (openApiSchema.components?.schemas) {
                        openApiSchema.components.schemas[schemaName] = z.toJSONSchema(schema);
                    }

                    const responseKey = name || `Error${statusCode}`;
                    if (openApiSchema.components?.responses) {
                        (openApiSchema.components.responses as Record<string, unknown>)[
                            responseKey
                        ] = {
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
        },
    };
}

export type OpenApiRegistry = ReturnType<typeof createOpenApiRegistry>;
