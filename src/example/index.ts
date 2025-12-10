import {ExpressKit, withContract, AppRoutes, RouteContract, AuthPolicy, SetupParams} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod';
import { createOpenApiRegistry  , bearerAuth, apiKeyAuth } from '../';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';

const theme = new SwaggerTheme();
const {registerRoutes} = createOpenApiRegistry({
  title: 'Super API',
  swaggerUi: {
    explorer: true,
    customCss: theme.getBuffer(SwaggerThemeNameEnum.DARK),
  },
})

import crypto from 'crypto';

// --- Basic Schemas ---
const UserSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
});

const ItemSchema = z.object({
    itemId: z.string().uuid(),
    itemName: z.string(),
    quantity: z.number().positive(),
});

const SuccessMessageSchema = z.object({
    message: z.string(),
    details: z.string().optional(),
});

const ErrorSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
    issues: z
        .array(z.object({message: z.string(), path: z.array(z.string().or(z.number()))}))
        .optional(),
});

const ItemDetailSchema = z.object({
    property: z.string(),
    value: z.string(),
});

const ExtendedItemSchema = ItemSchema.extend({
    description: z.string().optional(),
    details: z.array(ItemDetailSchema),
    relatedItemIds: z.array(z.uuid()).optional(),
});

// --- Authentication Handlers ---
// JWT Bearer Token Authentication Handler
const jwtAuthHandler = bearerAuth(
    'jwtAuth', // scheme name in OpenAPI docs
    ['read:users', 'write:users'], // optional scopes
)(function authenticate(req, res, next) {
    // Get the Authorization header
    const authHeader = req.headers.authorization;

    // Check if the header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({error: 'Unauthorized: Missing or invalid token'});
        return;
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    // In a real application, you would validate the JWT token here
    // For this example, we'll just check if it's a non-empty string
    if (!token) {
        res.status(401).json({error: 'Unauthorized: Invalid token'});
        return;
    }

    // For demo purposes, let's assume the token is valid if it's "valid_token"
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token !== 'valid_token') {
        res.status(401).json({error: 'Unauthorized: Invalid token'});
        return;
    }

    // If token is valid, proceed to the next middleware
    next();
});

// API Key Authentication Handler
const apiKeyHandler = apiKeyAuth(
    'apiKeyAuth', // scheme name
    'header', // location: 'header', 'query', or 'cookie'
    'X-API-Key', // parameter name
    ['read:items'], // optional scopes
)(function authenticate(req, res, next) {
    // Get the API key from the header
    const apiKey = req.headers['x-api-key'];

    // Check if the API key exists
    if (!apiKey) {
        res.status(401).json({error: 'Unauthorized: Missing API key'});
        return;
    }

    // For demo purposes, let's assume the API key is valid if it's "valid_api_key"
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (apiKey !== 'valid_api_key') {
        res.status(401).json({error: 'Unauthorized: Invalid API key'});
        return;
    }

    // If API key is valid, proceed to the next middleware
    next();
});

// --- Example 1: GET User by ID ---
const GetUserConfig = {
    operationId: 'getUserById',
    summary: 'Get a user by their ID',
    tags: ['Users'],
    request: {
        params: z.object({userId: z.uuid({message: 'Invalid user ID format'})}),
    },
    response: {
        content: {
            200: {
                schema: UserSchema,
                description: 'User found successfully.',
            },
            404: {
                schema: ErrorSchema,
                description: 'User not found.',
            },
            400: {
                // For invalid UUID by Zod
                schema: ErrorSchema,
                description: 'Invalid request parameters.',
            },
        },
    },
} satisfies RouteContract;

const getUserHandler = withContract(GetUserConfig)(async (req, res) => {
    const {userId} = req.params; // Typed and validated

    // Simulate database lookup
    if (userId === '00000000-0000-0000-0000-000000000000') {
        res.sendValidated(404, {error: 'User not found', code: 'USER_NOT_FOUND'});
    } else {
        const user = {
            id: userId,
            name: 'John Doe',
            email: 'john.doe@example.com',
            internalOnly: 'secret', // This would be stripped by serialize
        };
        res.sendValidated(200, user);
    }
});

// --- Example 2: Create Item ---
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
            201: {
                schema: ItemSchema,
                description: 'Item created successfully.',
            },
            400: {
                schema: ErrorSchema,
                description: 'Invalid item data provided.',
            },
            422: {
                // Example for a business logic validation error
                schema: ErrorSchema,
                description: 'Item could not be processed due to business rules.',
            },
        },
    },
} satisfies RouteContract;

const createItemHandler = withContract(CreateItemConfig)(async (req, res) => {
    const {itemName, quantity} = req.body; // Typed and validated

    // Simulate business logic
    if (itemName === 'forbidden_item') {
        res.sendTyped(422, {error: 'This item name is not allowed.', code: 'ITEM_FORBIDDEN'});
        return;
    }

    const newItem = {
        itemId: `item_${Date.now()}`, // wrong contract for example purposes, will cause serialization error
        itemName,
        quantity,
    };
    res.sendValidated(201, newItem);
});

// --- Example 3: Update User Email (Manual Validation Example) ---
const UpdateUserEmailConfig = {
    operationId: 'updateUserEmail',
    summary: "Update a user's email address",
    tags: ['Users'],
    request: {
        params: z.object({userId: z.uuid()}),
        body: z
            .object({
                email: z.email('Invalid email format'),
                confirmEmail: z.email('Invalid confirmation email format'),
            })
            .refine((data) => data.email === data.confirmEmail, {
                message: 'Emails do not match',
                path: ['confirmEmail'], // Path of the error
            }),
    },
    response: {
        content: {
            200: {
                schema: SuccessMessageSchema,
                description: 'Email updated successfully.',
            },
            400: {
                schema: ErrorSchema,
                description: 'Validation failed or emails did not match.',
            },
        },
    },
} satisfies RouteContract;

const updateUserEmailHandler = withContract(UpdateUserEmailConfig, {manualValidation: true})(async (req, res) => {
    // Manually trigger validation
    const {params, body} = await req.validate();
    // params.userId and body.email are now validated and typed

    res.sendTyped(200, {
        message: 'Email updated successfully',
        details: `User ${params.userId} email changed to ${body.email}`,
    });
});

// --- Example 4: No Response Body (204 No Content) ---
const DeleteItemConfig = {
    operationId: 'deleteItem',
    summary: 'Delete an item by ID',
    tags: ['Items'],
    request: {
        params: z.object({itemId: z.uuid()}),
    },
    response: {
        content: {
            204: {
                // For 204 No Content, often no schema is needed, or an empty schema.
                description: 'Item deleted successfully, no content returned.',
            },
            404: {
                schema: ErrorSchema,
                description: 'Item not found.',
            },
        },
    },
} satisfies RouteContract;

const deleteItemHandler = withContract(DeleteItemConfig)(async (req, res) => {
    const {itemId} = req.params;
    // Simulate deletion
    console.log(`Deleting item ${itemId}`);
    // For 204, you typically don't send a body.
    res.sendTyped(204);
});

// --- Example 5: GET Items (List of Nested Objects) ---
const GetItemsConfig = {
    operationId: 'getItems',
    summary: 'Get a list of items with nested details',
    tags: ['Items'],
    request: {
        query: z.object({
            limit: z.coerce.number().min(1).max(10).default(10),
            includeDetails: z.stringbool().optional().default(false),
        }),
    },
    response: {
        content: {
            200: {
                schema: z.array(ExtendedItemSchema),
                description: 'A list of items retrieved successfully.',
            },
            400: {
                schema: ErrorSchema,
                description: 'Invalid query parameters.',
            },
        },
    },
} satisfies RouteContract;

const getItemsHandler = withContract(GetItemsConfig)(async (req, res) => {
    const {limit} = req.query; // Typed and validated

    const includeDetails = true;
    const itemsData = Array.from({length: Math.min(limit || 10, 5)}, (_, i) => ({
        // Limit to 5 for example
        itemId: crypto.randomUUID(),
        itemName: `Item ${i + 1}`,
        quantity: (i + 1) * 2,
        description: includeDetails ? `This is detailed description for item ${i + 1}.` : undefined,
        details: includeDetails
            ? [
                  {property: 'Color', value: i % 2 === 0 ? 'Red' : 'Blue'},
                  {property: 'Material', value: 'Recycled'},
              ]
            : [],
        relatedItemIds: i % 2 === 0 ? [crypto.randomUUID(), crypto.randomUUID()] : [],
        // Extra field to demonstrate stripping by serialize
        internalNotes: 'This note is for internal use only and should be stripped.',
    }));

    res.sendValidated(200, itemsData);
});

// --- Setup ExpressKit Application (Illustrative) ---
export const routes: AppRoutes = {
    'GET /users/:userId': {
        handler: getUserHandler,
        authHandler: jwtAuthHandler, // Protect user data with JWT auth
        authPolicy: AuthPolicy.required,
    },
    'POST /items': {
        handler: createItemHandler,
        authHandler: apiKeyHandler, // Protect item creation with API key
        authPolicy: AuthPolicy.required,
    },
    'PUT /users/:userId/email': {
        handler: updateUserEmailHandler,
        authHandler: jwtAuthHandler, // Protect email updates with JWT auth
        authPolicy: AuthPolicy.required,
    },
    'DELETE /items/:itemId': {
        handler: deleteItemHandler,
        authHandler: apiKeyHandler, // Protect item deletion with API key
        authPolicy: AuthPolicy.required,
    },
    'GET /items': getItemsHandler, // Keep this route public
};

const nodekit = new NodeKit();

// Use setup parameter to integrate OpenAPI registry with access to global auth handlers
const app = new ExpressKit(nodekit, routes, ({routes, setupRoutes, setupBaseMiddleware, setupLangMiddleware, setupParsers, setupErrorHandlers}: SetupParams) => {
    setupBaseMiddleware();
    setupLangMiddleware();
    setupParsers();
    
    // Register routes with context to access global auth handlers from config
    const registeredRoutes = registerRoutes(routes /*, nodekit.ctx*/);
    setupRoutes(registeredRoutes);
    
    setupErrorHandlers();
});

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