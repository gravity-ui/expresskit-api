import {createOpenApiRegistry} from '../openapi-registry';
import {apiKeyAuth, bearerAuth} from '../security-schemas';
import {AppRoutes, AuthPolicy, RouteContract, withContract} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod';

describe('openapi-registry', () => {
    describe('createOpenApiRegistry', () => {
        it('should create registry with default configuration', () => {
            const {getOpenApiSchema} = createOpenApiRegistry({});

            const schema = getOpenApiSchema();
            expect(schema.openapi).toBe('3.0.3');
            expect(schema.info.title).toBe('API Documentation');
            expect(schema.info.version).toBe('1.0.0');
            expect(schema.info.description).toBe('Generated API documentation');
            expect(schema.servers).toEqual([{url: 'http://localhost:3030'}]);
            expect(schema.paths).toEqual({});
            expect(schema.components).toEqual({
                schemas: {},
                securitySchemes: {},
            });
        });

        it('should create registry with custom configuration', () => {
            const config = {
                title: 'Super API',
                version: '2.0.0',
                description: 'Custom API description',
                contact: {
                    name: 'API Team',
                    email: 'api@example.com',
                    url: 'https://example.com',
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT',
                },
                servers: [
                    {url: 'https://api.example.com', description: 'Production'},
                    {url: 'https://staging.example.com', description: 'Staging'},
                ],
                path: '/docs',
            };

            const {getOpenApiSchema} = createOpenApiRegistry(config);

            const schema = getOpenApiSchema();
            expect(schema.info.title).toBe(config.title);
            expect(schema.info.version).toBe(config.version);
            expect(schema.info.description).toBe(config.description);
            expect(schema.info.contact).toEqual(config.contact);
            expect(schema.info.license).toEqual(config.license);
            expect(schema.servers).toEqual(config.servers);
        });

        it('should create registry with swaggerUi options', () => {
            const {registerRoutes} = createOpenApiRegistry({
                swaggerUi: {
                    explorer: true,
                    customCss: '.swagger-ui { color: red; }',
                },
            });

            const nodekit = new NodeKit();

            const routes = {
                'GET /test': {
                    handler: withContract({
                        request: {},
                        response: {content: {200: z.object({})}},
                    })(async (_req, res) => {
                        res.sendTyped(200, {});
                    }),
                },
            };

            const registeredRoutes = registerRoutes(routes, nodekit);
            expect(registeredRoutes).toHaveProperty('MOUNT /api/docs');
        });
    });

    describe('registerRoutes', () => {
        let nodekit: NodeKit;

        beforeEach(() => {
            nodekit = new NodeKit();
        });

        it('should register GET route without auth', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const GetItemsConfig = {
                operationId: 'getItems',
                summary: 'Get items',
                request: {
                    query: z.object({limit: z.number().optional()}),
                },
                response: {
                    content: {
                        200: z.object({items: z.array(z.string())}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetItemsConfig)(async (_req, res) => {
                res.sendTyped(200, {items: []});
            });

            const routes = {
                'GET /items': handler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            expect(schema.paths['/items']).toBeDefined();
            const getOperation = schema.paths['/items'].get as Record<string, unknown>;
            expect(getOperation).toBeDefined();
            expect(getOperation.operationId).toBe('getItems');
            expect(getOperation.summary).toBe('Get items');
            expect(getOperation.security).toBeUndefined();
        });

        it('should register POST route with request body', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const CreateItemConfig = {
                operationId: 'createItem',
                request: {
                    body: z.object({
                        name: z.string(),
                        quantity: z.number(),
                        sku: z
                            .string()
                            .transform((value) => value.trim().toUpperCase())
                            .pipe(z.string().regex(/^SKU-[A-Z0-9]{4,12}$/)),
                        requestedAt: z.preprocess((value) => {
                            if (typeof value === 'string' || typeof value === 'number') {
                                const parsed = new Date(value);
                                return Number.isNaN(parsed.getTime())
                                    ? value
                                    : parsed.toISOString();
                            }

                            return value;
                        }, z.iso.datetime()),
                        tags: z
                            .preprocess((value) => {
                                if (typeof value === 'string') {
                                    return value.split(',');
                                }

                                return value;
                            }, z.array(z.string()).min(1))
                            .transform((tags) => tags.map((tag) => tag.trim().toLowerCase()))
                            .pipe(
                                z.array(
                                    z
                                        .string()
                                        .min(2)
                                        .max(20)
                                        .regex(/^[a-z0-9-]+$/),
                                ),
                            ),
                        aliases: z
                            .string()
                            .array()
                            .min(1)
                            .max(3)
                            .transform((aliases) =>
                                aliases.map((alias) => alias.trim().toLowerCase()),
                            ),
                    }),
                },
                response: {
                    content: {
                        201: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(CreateItemConfig)(async (_req, res) => {
                res.sendTyped(201, {id: '123'});
            });

            const routes = {
                'POST /items': handler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const postOperation = schema.paths['/items'].post as Record<string, unknown>;
            expect(postOperation).toBeDefined();
            const requestBody = postOperation.requestBody as Record<string, unknown>;
            expect(requestBody).toBeDefined();
            expect(requestBody.required).toBe(true);
            expect(requestBody.content).toBeDefined();

            const content = requestBody.content as Record<string, Record<string, unknown>>;
            const jsonBody = content['application/json'] as Record<string, unknown>;
            const bodySchema = jsonBody.schema as Record<string, unknown>;
            const properties = bodySchema.properties as Record<string, unknown>;

            expect(properties.sku).toBeDefined();
            expect(properties.requestedAt).toBeDefined();
            expect(properties.tags).toBeDefined();
            expect(properties.aliases).toBeDefined();
        });

        it('should register route with path parameters', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const GetUserConfig = {
                operationId: 'getUser',
                request: {
                    params: z.object({userId: z.string().uuid()}),
                },
                response: {
                    content: {
                        200: z.object({id: z.string(), name: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetUserConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.userId, name: 'Test'});
            });

            const routes = {
                'GET /users/:userId': handler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/users/{userId}'].get as Record<string, unknown>;
            expect(getOperation).toBeDefined();
            const parameters = getOperation.parameters as Array<{
                name: string;
                in: string;
                required: boolean;
            }>;
            expect(parameters).toBeDefined();
            const param = parameters.find((p) => p.name === 'userId');
            expect(param).toBeDefined();
            expect(param?.in).toBe('path');
            expect(param?.required).toBe(true);
        });

        it('should register route with query parameters', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const GetItemsConfig = {
                operationId: 'getItems',
                request: {
                    query: z.object({
                        limit: z.number().optional(),
                        offset: z.number().default(0),
                    }),
                },
                response: {
                    content: {
                        200: z.object({items: z.array(z.string())}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetItemsConfig)(async (_req, res) => {
                res.sendTyped(200, {items: []});
            });

            const routes = {
                'GET /items': handler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/items'].get as Record<string, unknown>;
            const params = getOperation.parameters as Array<{
                name: string;
                in: string;
            }>;
            expect(params).toBeDefined();
            const limitParam = params.find((p) => p.name === 'limit');
            const offsetParam = params.find((p) => p.name === 'offset');
            expect(limitParam).toBeDefined();
            expect(limitParam?.in).toBe('query');
            expect(offsetParam).toBeDefined();
            expect(offsetParam?.in).toBe('query');
        });

        it('should register route with headers', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const GetItemsConfig = {
                operationId: 'getItems',
                request: {
                    headers: z.object({
                        'x-request-id': z.string().uuid(),
                    }),
                },
                response: {
                    content: {
                        200: z.object({items: z.array(z.string())}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetItemsConfig)(async (_req, res) => {
                res.sendTyped(200, {items: []});
            });

            const routes = {
                'GET /items': handler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/items'].get as Record<string, unknown>;
            const params = getOperation.parameters as Array<{
                name: string;
                in: string;
            }>;
            const headerParam = params.find((p) => p.name === 'x-request-id');
            expect(headerParam).toBeDefined();
            expect(headerParam?.in).toBe('header');
        });

        it('should register route with multiple response codes', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const GetUserConfig = {
                operationId: 'getUser',
                request: {
                    params: z.object({userId: z.string().uuid()}),
                },
                response: {
                    content: {
                        200: {
                            schema: z.object({id: z.string(), name: z.string()}),
                            description: 'User found',
                        },
                        404: {
                            schema: z.object({error: z.string()}),
                            description: 'User not found',
                        },
                        400: {
                            schema: z.object({error: z.string()}),
                            description: 'Invalid request',
                        },
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetUserConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.userId, name: 'Test'});
            });

            const routes = {
                'GET /users/:userId': handler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/users/{userId}'].get as Record<string, unknown>;
            const responses = getOperation.responses as Record<string, {description: string}>;
            expect(responses['200']).toBeDefined();
            expect(responses['200'].description).toBe('User found');
            expect(responses['404']).toBeDefined();
            expect(responses['404'].description).toBe('User not found');
            expect(responses['400']).toBeDefined();
            expect(responses['400'].description).toBe('Invalid request');
        });

        it('should register route with JWT auth handler', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const jwtHandler = bearerAuth('jwtAuth', ['read:users'])((_req, _res, next) => {
                next();
            });

            const GetUserConfig = {
                operationId: 'getUser',
                request: {
                    params: z.object({userId: z.string().uuid()}),
                },
                response: {
                    content: {
                        200: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetUserConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.userId});
            });

            const routes = {
                'GET /users/:userId': {
                    handler,
                    authHandler: jwtHandler,
                    authPolicy: AuthPolicy.required,
                },
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/users/{userId}'].get as Record<string, unknown>;
            const security = getOperation.security as Array<Record<string, string[]>>;
            expect(security).toBeDefined();
            expect(security[0]).toHaveProperty('jwtAuth');
            expect(schema.components?.securitySchemes?.jwtAuth).toBeDefined();
            const jwtScheme = schema.components?.securitySchemes?.jwtAuth as {
                type: string;
                scheme: string;
            };
            expect(jwtScheme.type).toBe('http');
            expect(jwtScheme.scheme).toBe('bearer');
        });

        it('should register route with API key auth handler', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const apiKeyHandler = apiKeyAuth(
                'apiKeyAuth',
                'header',
                'X-API-Key',
            )((_req, _res, next) => {
                next();
            });

            const CreateItemConfig = {
                operationId: 'createItem',
                request: {
                    body: z.object({name: z.string()}),
                },
                response: {
                    content: {
                        201: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(CreateItemConfig)(async (_req, res) => {
                res.sendTyped(201, {id: '123'});
            });

            const routes = {
                'POST /items': {
                    handler,
                    authHandler: apiKeyHandler,
                    authPolicy: AuthPolicy.required,
                },
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const postOperation = schema.paths['/items'].post as Record<string, unknown>;
            const security = postOperation.security as Array<Record<string, string[]>>;
            expect(security).toBeDefined();
            expect(schema.components?.securitySchemes?.apiKeyAuth).toBeDefined();
            const apiKeyScheme = schema.components?.securitySchemes?.apiKeyAuth as {
                type: string;
                in: string;
                name: string;
            };
            expect(apiKeyScheme.type).toBe('apiKey');
            expect(apiKeyScheme.in).toBe('header');
            expect(apiKeyScheme.name).toBe('X-API-Key');
        });

        it('should register route with global auth handler from NodeKit config', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const globalAuthHandler = bearerAuth('globalJwt')((_req, _res, next) => {
                next();
            });

            const nodekitWithAuth = new NodeKit({
                config: {
                    appAuthHandler: globalAuthHandler,
                    appAuthPolicy: AuthPolicy.required,
                },
            });

            const GetUserConfig = {
                operationId: 'getUser',
                request: {
                    params: z.object({userId: z.string().uuid()}),
                },
                response: {
                    content: {
                        200: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetUserConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.userId});
            });

            const routes = {
                'GET /users/:userId': handler, // No authHandler specified
            };

            registerRoutes(routes, nodekitWithAuth);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/users/{userId}'].get as Record<string, unknown>;
            const security = getOperation.security as Array<Record<string, string[]>>;
            expect(security).toBeDefined();
            expect(schema.components?.securitySchemes?.globalJwt).toBeDefined();
        });

        it('should not register security for route with disabled auth policy', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const jwtHandler = bearerAuth('jwtAuth')((_req, _res, next) => {
                next();
            });

            const GetUserConfig = {
                operationId: 'getUser',
                request: {
                    params: z.object({userId: z.string().uuid()}),
                },
                response: {
                    content: {
                        200: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetUserConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.userId});
            });

            const routes = {
                'GET /users/:userId': {
                    handler,
                    authHandler: jwtHandler,
                    authPolicy: AuthPolicy.disabled,
                },
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/users/{userId}'].get as Record<string, unknown>;
            expect(getOperation.security).toBeUndefined();
        });

        it('should register multiple HTTP methods for same path', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const GetItemConfig = {
                operationId: 'getItem',
                request: {
                    params: z.object({itemId: z.string().uuid()}),
                },
                response: {
                    content: {
                        200: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const UpdateItemConfig = {
                operationId: 'updateItem',
                request: {
                    params: z.object({itemId: z.string().uuid()}),
                    body: z.object({name: z.string()}),
                },
                response: {
                    content: {
                        200: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const getHandler = withContract(GetItemConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.itemId});
            });

            const updateHandler = withContract(UpdateItemConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.itemId});
            });

            const routes = {
                'GET /items/:itemId': getHandler,
                'PUT /items/:itemId': updateHandler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            expect(schema.paths['/items/{itemId}'].get).toBeDefined();
            expect(schema.paths['/items/{itemId}'].put).toBeDefined();
        });

        it('should add MOUNT route for Swagger UI', () => {
            const {registerRoutes} = createOpenApiRegistry({
                title: 'Test API',
                path: '/custom-docs',
            });

            const routes = {
                'GET /test': {
                    handler: withContract({
                        request: {},
                        response: {content: {200: z.object({})}},
                    })(async (_req, res) => {
                        res.sendTyped(200, {});
                    }),
                },
            };

            const registeredRoutes = registerRoutes(routes, nodekit);
            expect(registeredRoutes).toHaveProperty('MOUNT /custom-docs');
        });

        it('should use default path /api/docs if path not specified', () => {
            const {registerRoutes} = createOpenApiRegistry({
                title: 'Test API',
            });

            const routes = {
                'GET /test': {
                    handler: withContract({
                        request: {},
                        response: {content: {200: z.object({})}},
                    })(async (_req, res) => {
                        res.sendTyped(200, {});
                    }),
                },
            };

            const registeredRoutes = registerRoutes(routes, nodekit);
            expect(registeredRoutes).toHaveProperty('MOUNT /api/docs');
        });

        it('should handle routes with tags and description', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const GetUserConfig = {
                operationId: 'getUser',
                summary: 'Get user by ID',
                description: 'Retrieves a user by their unique identifier',
                tags: ['Users', 'Public'],
                request: {
                    params: z.object({userId: z.string().uuid()}),
                },
                response: {
                    content: {
                        200: z.object({id: z.string()}),
                    },
                },
            } satisfies RouteContract;

            const handler = withContract(GetUserConfig)(async (req, res) => {
                res.sendTyped(200, {id: req.params.userId});
            });

            const routes = {
                'GET /users/:userId': handler,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            const getOperation = schema.paths['/users/{userId}'].get as Record<string, unknown>;
            expect(getOperation.summary).toBe('Get user by ID');
            expect(getOperation.description).toBe('Retrieves a user by their unique identifier');
            expect(getOperation.tags).toEqual(['Users', 'Public']);
        });

        it('should skip routes without contracts', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const handlerWithoutContract = async (
                _req: unknown,
                res: {send: (data: unknown) => void},
            ) => {
                res.send({});
            };

            const routes = {
                'GET /test': handlerWithoutContract,
            };

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            expect(schema.paths['/test']).toBeUndefined();
        });

        it('should skip unrecognized HTTP methods', () => {
            const {registerRoutes, getOpenApiSchema} = createOpenApiRegistry({
                title: 'Test API',
            });

            const handler = withContract({
                request: {},
                response: {content: {200: z.object({})}},
            })(async (_req, res) => {
                res.sendTyped(200, {});
            });

            const routes = {
                'INVALID /test': handler,
            } as unknown as AppRoutes;

            registerRoutes(routes, nodekit);
            const schema = getOpenApiSchema();

            expect(schema.paths['/test']).toBeUndefined();
        });
    });

    describe('reset', () => {
        it('should reset paths and components', () => {
            const {registerRoutes, getOpenApiSchema, reset} = createOpenApiRegistry({
                title: 'Test API',
            });

            const handler = withContract({
                operationId: 'test',
                request: {},
                response: {content: {200: z.object({})}},
            })(async (_req, res) => {
                res.sendTyped(200, {});
            });

            const routes = {
                'GET /test': handler,
            };

            registerRoutes(routes, new NodeKit());
            let schema = getOpenApiSchema();

            expect(schema.paths['/test']).toBeDefined();

            reset();
            schema = getOpenApiSchema();

            expect(schema.paths).toEqual({});
            expect(schema.components?.schemas).toEqual({});
            expect(schema.components?.securitySchemes).toEqual({});
        });
    });
});
