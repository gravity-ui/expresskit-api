import {RouteContract, withContract} from '@gravity-ui/expresskit';
import {z} from 'zod';
import {ErrorSchema, ItemSchema} from '../schemas';

const SkuSchema = z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(
        z.string().regex(/^SKU-[A-Z0-9]{4,12}$/, 'SKU must match format SKU-XXXX (alphanumeric)'),
    );

const RequestedAtSchema = z.preprocess((value) => {
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
    }

    return value;
}, z.iso.datetime());

const TagsSchema = z
    .preprocess(
        (value) => {
            if (typeof value === 'string') {
                return value.split(',');
            }

            return value;
        },
        z
            .string()
            .array()
            .min(1, 'At least one tag is required')
            .max(5, 'At most 5 tags are allowed'),
    )
    .transform((tags) => tags.map((tag) => tag.trim().toLowerCase()))
    .pipe(
        z.array(
            z
                .string()
                .min(2, 'Each tag must be at least 2 characters long')
                .max(20, 'Each tag must be at most 20 characters long')
                .regex(
                    /^[a-z0-9-]+$/,
                    'Tags must contain only lowercase letters, numbers, and hyphens',
                ),
        ),
    );

const AliasesSchema = z
    .string()
    .array()
    .min(1, 'At least one alias is required')
    .max(3, 'At most 3 aliases are allowed')
    .transform((aliases) => aliases.map((alias) => alias.trim().toLowerCase()));

// --- Example 2: Create Item ---
export const CreateItemConfig = {
    operationId: 'createItem',
    summary: 'Create a new item',
    tags: ['Items'],
    request: {
        body: z.object({
            itemName: z.string().min(3, 'Item name must be at least 3 characters long'),
            quantity: z.number().int().positive('Quantity must be a positive integer'),
            sku: SkuSchema,
            requestedAt: RequestedAtSchema,
            tags: TagsSchema,
            aliases: AliasesSchema.optional(),
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

export const createItemHandler = withContract(CreateItemConfig)(async (req, res) => {
    const {itemName, quantity, sku, requestedAt, tags, aliases} = req.body; // Typed and validated

    // Simulate business logic
    if (itemName === 'forbidden_item') {
        res.sendTyped(422, {
            error: 'This item name is not allowed.',
            code: 'ITEM_FORBIDDEN',
        });
        return;
    }

    const newItem = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        itemName,
        quantity,
        sku,
        requestedAtIso: requestedAt,
        tags,
        aliases,
    };

    res.sendValidated(201, newItem);
});
