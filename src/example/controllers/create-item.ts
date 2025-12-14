import { RouteContract, withContract } from "@gravity-ui/expresskit";
import { z } from "zod";
import { ErrorSchema, ItemSchema } from "../schemas";

// --- Example 2: Create Item ---
export const CreateItemConfig = {
  operationId: "createItem",
  summary: "Create a new item",
  tags: ["Items"],
  request: {
    body: z.object({
      itemName: z
        .string()
        .min(3, "Item name must be at least 3 characters long"),
      quantity: z
        .number()
        .int()
        .positive("Quantity must be a positive integer"),
    }),
  },
  response: {
    content: {
      201: {
        schema: ItemSchema,
        description: "Item created successfully.",
      },
      400: {
        schema: ErrorSchema,
        description: "Invalid item data provided.",
      },
      422: {
        // Example for a business logic validation error
        schema: ErrorSchema,
        description: "Item could not be processed due to business rules.",
      },
    },
  },
} satisfies RouteContract;

export const createItemHandler = withContract(CreateItemConfig)(async (
  req,
  res,
) => {
  const { itemName, quantity } = req.body; // Typed and validated

  // Simulate business logic
  if (itemName === "forbidden_item") {
    res.sendTyped(422, {
      error: "This item name is not allowed.",
      code: "ITEM_FORBIDDEN",
    });
    return;
  }

  const newItem = {
    itemId: `item_${Date.now()}`, // wrong contract for example purposes, will cause serialization error
    itemName,
    quantity,
  };
  res.sendValidated(201, newItem);
});
