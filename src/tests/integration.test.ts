import request from 'supertest';
import type {Express} from 'express';
import {ExpressKit, RouteContract, withContract} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {createOpenApiRegistry} from '../openapi-registry';
import {z} from 'zod';

describe('ExpressKit Integration Tests', () => {
    const testRouteConfig = {
        operationId: 'getTest',
        request: {},
        response: {
            content: {
                200: z.object({message: z.string()}),
            },
        },
    } satisfies RouteContract;

    const nodekit = new NodeKit({
        config: {
            appName: 'test-app',
            appLoggingDestination: {
                write: () => {},
            },
        },
    });

    const testHandler = withContract(testRouteConfig)(async (_req, res) => {
        res.sendTyped(200, {message: 'test'});
    });

    const routes = {
        'GET /test': testHandler,
    };

    describe('default configuration', () => {
        let expressApp: Express;

        beforeAll(() => {
            const {registerRoutes} = createOpenApiRegistry({});
            const testApp = new ExpressKit(nodekit, registerRoutes(routes, nodekit));
            expressApp = testApp.express;
        });

        it('should serve Swagger UI at /api/docs', async () => {
            const response = await request(expressApp).get('/api/docs').redirects(1).expect(200);

            expect(response.headers['content-type']).toMatch(/text\/html/);
        });
    });

    describe('custom mount path', () => {
        let expressApp: Express;

        beforeAll(() => {
            const {registerRoutes} = createOpenApiRegistry({
                title: 'Test API',
                path: '/custom-path',
            });

            const testApp = new ExpressKit(nodekit, registerRoutes(routes, nodekit));
            expressApp = testApp.express;
        });

        it('should serve Swagger UI at /custom-path', async () => {
            const response = await request(expressApp).get('/custom-path').redirects(1).expect(200);

            expect(response.headers['content-type']).toMatch(/text\/html/);
        });

        it('should not serve Swagger UI at /api/docs', async () => {
            await request(expressApp).get('/api/docs').expect(404);
        });
    });

    describe('swaggerJsonPath is set', () => {
        let expressApp: Express;

        beforeAll(() => {
            const {registerRoutes} = createOpenApiRegistry({
                title: 'Test API',
                path: '/api-docs',
                swaggerJsonPath: '/swagger.json',
            });

            const testApp = new ExpressKit(nodekit, registerRoutes(routes, nodekit));
            expressApp = testApp.express;
        });

        it('should serve OpenAPI schema as JSON when swaggerJsonPath is configured', async () => {
            const response = await request(expressApp)
                .get('/api-docs/swagger.json')
                .expect(200)
                .expect('Content-Type', /application\/json/);

            const schema = response.body;
            expect(schema).toBeDefined();
            expect(schema.openapi).toBe('3.0.3');
            expect(schema.info).toBeDefined();
            expect(schema.info.title).toBe('Test API');
            expect(schema.paths).toBeDefined();
            expect(schema.components).toBeDefined();
        });

        it('should be accessible from Swagger UI', async () => {
            const uiResponse = await request(expressApp).get('/api-docs').redirects(1).expect(200);

            expect(uiResponse.headers['content-type']).toMatch(/text\/html/);
        });
    });
});
