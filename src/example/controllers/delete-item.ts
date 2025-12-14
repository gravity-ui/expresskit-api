/* eslint-disable no-console */
import { RouteContract, withContract } from "@gravity-ui/expresskit";
import { z } from "zod";
import { ErrorSchema } from "../schemas";

// --- Example 4: No Response Body (204 No Content) ---
export const DeleteItemConfig = {
  operationId: "deleteItem",
  summary: "Delete an item by ID",
  tags: ["Items"],
  request: {
    params: z.object({ itemId: z.uuid() }),
  },
  response: {
    content: {
      204: {
        // For 204 No Content, often no schema is needed, or an empty schema.
        description: "Item deleted successfully, no content returned.",
      },
      404: {
        schema: ErrorSchema,
        description: "Item not found.",
      },
    },
  },
} satisfies RouteContract;

export const deleteItemHandler = withContract(DeleteItemConfig)(async (
  req,
  res,
) => {
  const { itemId } = req.params;
  // Simulate deletion
  console.log(`Deleting item ${itemId}`);
  // For 204, you typically don't send a body.
  res.sendTyped(204);
});
