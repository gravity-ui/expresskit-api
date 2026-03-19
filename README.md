# ExpressKit OpenApi Integration

This package provides OpenAPI/Swagger integration for [ExpressKit](https://github.com/gravity-ui/expresskit), automatically generating API documentation from your route contracts and authentication handlers.

## Quick Start

1. Add the integration to an existing ExpressKit project:

   ```bash
   npm install @gravity-ui/expresskit-api
   ```

2. Wrap your routes before passing them to `ExpressKit`:

```typescript
import {ExpressKit, withContract, AppRoutes, RouteContract} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod';
import {createOpenApiRegistry} from '@gravity-ui/expresskit-api';

const {registerRoutes} = createOpenApiRegistry({title: 'Super API'});

const CreateItemConfig = {
  operationId: 'createItem',
  summary: 'Create a new item',
  tags: ['Items'],
  request: {
    body: z.object({
      itemName: z.string().min(3, 'Item name must be at least 3 characters long'),
      quantity: z.number().int().positive('Quantity must be a positive integer'),
    }),
  },
  response: {
    content: {
      201: z.object({
        itemId: z.string(),
        itemName: z.string(),
        quantity: z.number().positive(),
      }),
    },
  },
} satisfies RouteContract;

const createItemHandler = withContract(CreateItemConfig)(async (req, res) => {
  const {itemName, quantity} = req.body;

  const newItem = {
    itemId: `item_${Date.now()}`,
    itemName,
    quantity,
  };

  res.sendTyped(201, newItem);
});

export const routes: AppRoutes = {
  'POST /items': {
    handler: createItemHandler,
  },
};

const app = new ExpressKit(nodekit, registerRoutes(routes, nodekit));

app.run(); // Open http://localhost:3030/api/docs
```

3. Start the app and open [http://localhost:3030/api/docs](http://localhost:3030/api/docs) to view Swagger UI.

## Config

`createOpenApiRegistry(config?: OpenApiRegistryConfig)` tunes both the generated schema and the Swagger UI mount. Key options:

| Field             | Default                                | Description                                                                                                                                                    |
| ----------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`           | `"API Documentation"`                  | Top-level title shown in the UI.                                                                                                                               |
| `version`         | `"1.0.0"`                              | Populates `info.version`.                                                                                                                                      |
| `description`     | `"Generated API documentation"`        | Short blurb under the title.                                                                                                                                   |
| `contact`         | `undefined`                            | `{name, email, url}` for ownership info.                                                                                                                       |
| `license`         | `undefined`                            | `{name, url}` displayed in the footer.                                                                                                                         |
| `servers`         | `[ { url: 'http://localhost:3030' } ]` | Servers array for the spec dropdown.                                                                                                                           |
| `swaggerUi`       | `{}`                                   | Passed straight to `swagger-ui-express` (`customCss`, `explorer`, themes, …).                                                                                  |
| `enabled`         | `true`                                 | Convenience flag—skip calling `registerRoutes` if you want to hide docs.                                                                                       |
| `path`            | `'/api/docs'`                          | Mount path for Swagger UI; value is used as-is.                                                                                                                |
| `swaggerJsonPath` | `undefined`                            | Path relative to mount path where OpenAPI schema is served as JSON. When set, Swagger UI loads the schema from this endpoint instead of embedding it directly. |
| `authPolicy`      | `AuthPolicy.disabled`                  | Controls authentication for the Swagger UI page itself.                                                                                                        |

Usage example:

```typescript
const {registerRoutes} = createOpenApiRegistry({
  title: 'Super API',
  description: 'Internal platform endpoints',
  servers: [{url: 'https://api.example.com'}],
  swaggerUi: {
    explorer: true,
    customCss: '.topbar { display: none; }',
  },
});
```

**Using `swaggerJsonPath` for async schema loading:**

```typescript
const {registerRoutes} = createOpenApiRegistry({
  title: 'Super API',
  path: '/api/docs',
  swaggerJsonPath: '/swagger.json', // Relative to mount path
});

// The schema will be available at /api/docs/swagger.json
// Swagger UI will load it asynchronously from this endpoint
```

- [Basic Usage](#basic-usage)
- [Available Security Scheme Types](#available-security-scheme-types)
- [Custom Security Schemes](#custom-security-schemes)
- [Styling Swagger UI](#styling-swagger-ui)

---

## Security Schemes for OpenAPI Documentation

ExpressKit supports automatic generation of security requirements in OpenAPI documentation based on the authentication handlers used in your routes.

### Features

- **HOC Wrappers** allow you to add security metadata to any authentication handler.
- **Predefined Security Schemes**: Ready-to-use wrappers for common authentication types:
  - `bearerAuth`: JWT/Bearer token authentication
  - `apiKeyAuth`: API key authentication
  - `basicAuth`: Basic authentication
  - `oauth2Auth`: OAuth2 authentication
  - `oidcAuth`: OpenID Connect authentication
- **Automatic Documentation**: Security requirements are automatically included in OpenAPI documentation. **Schemas are supported for both per-route `authHandler`s and global `appAuthHandler`s configured via NodeKit.**

### Basic Usage

```typescript
import {bearerAuth} from '@gravity-ui/expresskit-api';
import jwt from 'jsonwebtoken';

// Add OpenAPI security scheme metadata to your auth handler
const jwtAuthHandler = bearerAuth('myJwtAuth')(function authenticate(req, res, next) {
  // Your authentication logic here
  next();
});

// Use in routes
const routes = {
  'GET /api/protected': {
    handler: protectedRouteHandler,
    authHandler: jwtAuthHandler,
  },
};
```

### Available Security Scheme Types

#### Bearer Token Authentication

```typescript
const jwtAuthHandler = bearerAuth(
  'jwtAuth', // scheme name in OpenAPI docs
  ['read:users', 'write:users'], // optional scopes
)(authFunction);
```

#### API Key Authentication

```typescript
const apiKeyHandler = apiKeyAuth(
  'apiKeyAuth', // scheme name
  'header', // location: 'header', 'query', or 'cookie'
  'X-API-Key', // parameter name
  ['read', 'write'], // optional scopes
)(authFunction);
```

#### Basic Authentication

```typescript
const basicAuthHandler = basicAuth(
  'basicAuth', // scheme name
  ['read', 'write'], // optional scopes
)(authFunction);
```

#### OAuth2 Authentication

```typescript
const oauth2Handler = oauth2Auth(
  'oauth2Auth', // scheme name
  {
    implicit: {
      authorizationUrl: 'https://example.com/oauth/authorize',
      scopes: {
        read: 'Read access',
        write: 'Write access',
      },
    },
  },
  ['read', 'write'], // optional scopes for this specific handler
)(authFunction);
```

#### OpenID Connect Authentication

```typescript
const oidcHandler = oidcAuth(
  'oidcAuth', // scheme name
  'https://example.com/.well-known/openid-configuration',
  ['profile', 'email'], // optional scopes
)(authFunction);
```

### Custom Security Schemes

If you need a custom security scheme, you can use the `withSecurityScheme` function directly:

```typescript
import {withSecurityScheme} from '@gravity-ui/expresskit-api';

const customAuthHandler = withSecurityScheme({
  name: 'myCustomScheme',
  scheme: {
    type: 'http',
    scheme: 'digest',
    description: 'Digest authentication',
  },
  scopes: ['read', 'write'],
})(authFunction);
```

### Customizing the OpenAPI operation

You can customize the generated OpenAPI operation using the `transformOperation` callback in `createOpenApiRegistry`.

This allows you to patch operations based on the route path, method, or route description properties. This is especially useful if you are using custom authentication handlers that aren't wrapped with `withSecurityScheme`, or if you want to apply global tags.

```typescript
const {registerRoutes, registerSecurityScheme} = createOpenApiRegistry({
  title: 'My API',
  transformOperation: (operation, {path, route}) => {
    // Patch by path
    if (path === '/items') {
      return {
        ...operation,
        security: [{customApiKey: []}],
      };
    }

    // Patch by route property
    if (route.authPolicy === 'disabled') {
      return {
        ...operation,
        description: `(Public) ${operation.description || ''}`,
      };
    }

    return operation;
  },
});

// 1. Register a custom security scheme globally
registerSecurityScheme('customApiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
});

const routes = {
  'POST /items': {
    handler: createItemHandler,
    authHandler: customAuthMiddleware, // Not wrapped with withSecurityScheme
  },
};

// 2. Register routes
registerRoutes(routes, nodekit);
```

## Styling Swagger UI

Customize the Swagger UI via `swaggerUi` options or by bringing in theme helpers such as [`swagger-themes`](https://www.npmjs.com/package/swagger-themes):

```typescript
import {SwaggerTheme, SwaggerThemeNameEnum} from 'swagger-themes';

const theme = new SwaggerTheme();
const {registerRoutes} = createOpenApiRegistry({
  swaggerUi: {
    explorer: true,
    customCss: theme.getBuffer(SwaggerThemeNameEnum.DARK),
  },
});
```

See `src/example/index.ts` for a more elaborate setup that combines authentication examples with custom styling.
