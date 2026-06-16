export function buildContentSecurityPolicyDirectives(environment = process.env.NODE_ENV) {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: environment === "development"
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
      : ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "blob:"],
    mediaSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'", "ws:", "wss:"],
  };
}
