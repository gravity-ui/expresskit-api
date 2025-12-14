import { z } from "zod";

// --- Basic Schemas ---
export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
});

export const ItemSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string(),
  quantity: z.number().positive(),
});

export const SuccessMessageSchema = z.object({
  message: z.string(),
  details: z.string().optional(),
});

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  issues: z
    .array(
      z.object({
        message: z.string(),
        path: z.array(z.string().or(z.number())),
      }),
    )
    .optional(),
});

export const ItemDetailSchema = z.object({
  property: z.string(),
  value: z.string(),
});

export const ExtendedItemSchema = ItemSchema.extend({
  description: z.string().optional(),
  details: z.array(ItemDetailSchema),
  relatedItemIds: z.array(z.uuid()).optional(),
});
