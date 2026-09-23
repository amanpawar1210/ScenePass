export const config = {
  port: Number(process.env.PORT) || 4500,
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "scenepass-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  isProduction: process.env.NODE_ENV === "production",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:4200",
};

if (config.isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}
