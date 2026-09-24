export const config = {
  port: Number(process.env.PORT) || 4500,
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "scenepass-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  isProduction: process.env.NODE_ENV === "production",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:4200",
  // Public URL of the web app, used in emails and QR codes.
  appUrl: (process.env.APP_URL || "http://localhost:4200").replace(/\/+$/, ""),
  // Any SMTP connection string, e.g. smtps://user:pass@smtp.gmail.com. Without it,
  // emails go to a free Ethereal test inbox and the API returns a preview link.
  smtpUrl: process.env.SMTP_URL || "",
  mailFrom: process.env.MAIL_FROM || "ScenePass <tickets@scenepass.app>",
};

if (config.isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}
