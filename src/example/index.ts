/* eslint-disable no-console */
import {ExpressKit} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {createOpenApiRegistry} from '../';
import {SwaggerTheme, SwaggerThemeNameEnum} from 'swagger-themes';
import {routes} from './routes';

const theme = new SwaggerTheme();
const {registerRoutes} = createOpenApiRegistry({
    title: 'Super API',
    swaggerUi: {
        explorer: true,
        customCss: theme.getBuffer(SwaggerThemeNameEnum.DARK),
    },
});

const nodekit = new NodeKit({
    config: {
        appName: 'example-app',
        appLoggingDestination: {
            write: () => {},
        },
    },
});

const app = new ExpressKit(nodekit, registerRoutes(routes, nodekit));

// Only run the app if this file is executed directly (not when imported for tests)
if (require.main === module) {
    app.run();

    console.log(`Example server running on port`);
    console.log('Try:');
    console.log('  GET /users/123e4567-e89b-12d3-a456-426614174000');
    console.log('    Header: Authorization: Bearer valid_token');
    console.log('  GET /users/00000000-0000-0000-0000-000000000000 (for 404)');
    console.log('    Header: Authorization: Bearer valid_token');
    console.log('  POST /items with JSON body { "itemName": "My New Item", "quantity": 10 }');
    console.log('    Header: X-API-Key: valid_api_key');
    console.log('  POST /items with JSON body { "itemName": "forbidden_item", "quantity": 1 }');
    console.log('    Header: X-API-Key: valid_api_key');
    console.log(
        '  PUT /users/123e4567-e89b-12d3-a456-426614174000/email with JSON body { "email": "new@example.com", "confirmEmail": "new@example.com" }',
    );
    console.log('    Header: Authorization: Bearer valid_token');
    console.log(
        '  PUT /users/123e4567-e89b-12d3-a456-426614174000/email with JSON body { "email": "new@example.com", "confirmEmail": "other@example.com" }',
    );
    console.log('    Header: Authorization: Bearer valid_token');
    console.log('  DELETE /items/123e4567-e89b-12d3-a456-426614174000');
    console.log('    Header: X-API-Key: valid_api_key');
    console.log('  GET /items (public route, no authentication required)');
    console.log('  GET /items?limit=3&includeDetails=false');
}

export default app;
