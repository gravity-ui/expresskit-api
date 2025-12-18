import {AppRoutes, AuthPolicy} from '@gravity-ui/expresskit';
import {jwtAuthHandler} from './auth/jwt-auth';
import {apiKeyHandler} from './auth/api-key-auth';
import {
    createItemHandler,
    deleteItemHandler,
    getItemsHandler,
    getUserHandler,
    updateUserEmailHandler,
} from './controllers';

export const routes: AppRoutes = {
    'GET /users/:userId': {
        handler: getUserHandler,
        authHandler: jwtAuthHandler,
        authPolicy: AuthPolicy.required,
    },
    'POST /items': {
        handler: createItemHandler,
        authHandler: apiKeyHandler,
        authPolicy: AuthPolicy.required,
    },
    'PUT /users/:userId/email': {
        handler: updateUserEmailHandler,
        authHandler: jwtAuthHandler,
        authPolicy: AuthPolicy.required,
    },
    'DELETE /items/:itemId': {
        handler: deleteItemHandler,
        authHandler: apiKeyHandler,
        authPolicy: AuthPolicy.required,
    },
    'GET /items': getItemsHandler,
};
