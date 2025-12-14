import { apiKeyAuth } from "../../";

// API Key Authentication Handler
export const apiKeyHandler = apiKeyAuth(
  "apiKeyAuth", // scheme name
  "header", // location: 'header', 'query', or 'cookie'
  "X-API-Key", // parameter name
  ["read:items"], // optional scopes
)(function authenticate(req, res, next) {
  // Get the API key from the header
  const apiKey = req.headers["x-api-key"];

  // Check if the API key exists
  if (!apiKey) {
    res.status(401).json({ error: "Unauthorized: Missing API key" });
    return;
  }

  // For demo purposes, let's assume the API key is valid if it's "valid_api_key"
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (apiKey !== "valid_api_key") {
    res.status(401).json({ error: "Unauthorized: Invalid API key" });
    return;
  }

  // If API key is valid, proceed to the next middleware
  next();
});
