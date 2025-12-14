import { bearerAuth } from "../../";

// JWT Bearer Token Authentication Handler
export const jwtAuthHandler = bearerAuth(
  "jwtAuth", // scheme name in OpenAPI docs
  ["read:users", "write:users"], // optional scopes
)(function authenticate(req, res, next) {
  // Get the Authorization header
  const authHeader = req.headers.authorization;

  // Check if the header exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    return;
  }

  // Extract the token
  const token = authHeader.split(" ")[1];

  // In a real application, you would validate the JWT token here
  // For this example, we'll just check if it's a non-empty string
  if (!token) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
    return;
  }

  // For demo purposes, let's assume the token is valid if it's "valid_token"
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (token !== "valid_token") {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
    return;
  }

  // If token is valid, proceed to the next middleware
  next();
});
