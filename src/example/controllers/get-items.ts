import {RouteContract, withContract} from '@gravity-ui/expresskit';
import {z} from 'zod';
import * as crypto from 'crypto';
import {ErrorSchema, ExtendedItemSchema} from '../schemas';

// --- Example 5: GET Items (List of Nested Objects) ---
export const GetItemsConfig = {
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

export const getItemsHandler = withContract(GetItemsConfig)(async (req, res) => {
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
