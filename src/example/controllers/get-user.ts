import {RouteContract, withContract} from '@gravity-ui/expresskit';
import {z} from 'zod';
import {ErrorSchema, UserSchema} from '../schemas';

// --- Example 1: GET User by ID ---
export const GetUserConfig = {
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

export const getUserHandler = withContract(GetUserConfig)(async (req, res) => {
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
