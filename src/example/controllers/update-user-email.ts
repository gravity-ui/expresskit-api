import {RouteContract, withContract} from '@gravity-ui/expresskit';
import {z} from 'zod';
import {ErrorSchema, SuccessMessageSchema} from '../schemas';

// --- Example 3: Update User Email (Manual Validation Example) ---
export const UpdateUserEmailConfig = {
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

export const updateUserEmailHandler = withContract(UpdateUserEmailConfig, {
    manualValidation: true,
})(async (req, res) => {
    // Manually trigger validation
    const {params, body} = await req.validate();
    // params.userId and body.email are now validated and typed

    res.sendTyped(200, {
        message: 'Email updated successfully',
        details: `User ${params.userId} email changed to ${body.email}`,
    });
});
