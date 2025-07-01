const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Import configurations
const { connectDatabase } = require("./config/database");
const { initializeSocket } = require("./config/socket");
const { specs, swaggerUi } = require("./config/swagger");

// Import routes
const routes = require("./routes");

const app = express();
const server = http.createServer(app);

// Trust proxy for rate limiting and IP detection (important for Docker/proxy environments)
app.set("trust proxy", 1);

// Connect to database first
connectDatabase();

// Initialize Socket.IO for real-time game functionality
const io = initializeSocket(server);

// Security middleware
// app.use(
//   helmet({
//     contentSecurityPolicy: false, // Disabled for WebSocket compatibility
//   })
// );

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // Much higher limit for development
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Handle proxy environments properly
  trustProxy: true,
  skip: (req) => {
    // Skip rate limiting for development
    return process.env.NODE_ENV !== "production";
  },
});
app.use("/api", limiter);

// CORS configuration - Must be before other middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests, or server-to-server)
      if (!origin) return callback(null, true);

      // In development, allow all origins
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Production: check against allowed origins
      const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

      if (allowedOrigins.length === 0) {
        // If no FRONTEND_URL is set in production, log warning but allow
        console.warn("Warning: No FRONTEND_URL set in production environment");
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In production, reject unrecognized origins
      console.warn(`CORS rejected origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true, // Allow cookies in CORS
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // Add cookie parser for handling cookies

// Handle preflight requests
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS,PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-Requested-With"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

// Logging middleware
app.use(morgan("combined"));

// Static files
app.use(express.static("public"));

// Make io available to routes
app.set("io", io);

// Swagger API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Head Ball Game API Documentation",
  })
);

// Security headers for production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    // Prevent XSS
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // HTTPS enforcement
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );

    // Content Security Policy
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';"
    );

    next();
  });
}

// API Routes
app.use("/api", routes);

// Simple connection check
app.get("/", (req, res) => {
  res.json({
    message: "Connected",
    status: "Server is running",
    documentation: "Visit /api-docs for API documentation",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  // Don't log expected CORS errors as unhandled errors
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "CORS policy violation",
      message: "Origin not allowed",
    });
  }

  // Log genuine unhandled errors
  console.error("Unhandled error:", err);

  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
});

module.exports = server;
