const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Head Ball Real-Time Game API",
      version: "1.0.0",
      description:
        "WebSocket + REST API for 1v1 gameplay with real-time features",
      contact: {
        name: "MetaHead Arena",
        url: "https://github.com/MetaHead-Arena/Back-End",
      },
      license: {
        name: "ISC",
        url: "https://opensource.org/licenses/ISC",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://head-arena.up.railway.app",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "JWT token obtained from /api/auth/verify endpoint. Store in localStorage and send in Authorization header as 'Bearer <token>'",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "User ID",
            },
            walletAddress: {
              type: "string",
              description: "Web3 wallet address",
              example: "0x742d35Cc6634C0532925a3b8D",
            },
            gameStats: {
              type: "object",
              properties: {
                wins: { type: "number" },
                losses: { type: "number" },
                draws: { type: "number" },
                totalMatches: { type: "number" },
                matchHistory: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },

            joinedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Match: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "The auto-generated id of the match",
            },
            players: {
              type: "array",
              items: { type: "string" },
              description: "Array of player user IDs",
            },
            winner: {
              type: "string",
              description: "Winner user ID",
            },
            scores: {
              type: "object",
              description: "Match scores for each player",
            },
            duration: {
              type: "number",
              description: "Match duration in seconds",
            },
            status: {
              type: "string",
              enum: ["ongoing", "completed", "abandoned"],
              description: "Match status",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            message: {
              type: "string",
              description: "Detailed error description",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the authentication was successful",
              example: true,
            },
            message: {
              type: "string",
              description: "Success message",
              example: "Authentication successful",
            },
            data: {
              type: "object",
              properties: {
                token: {
                  type: "string",
                  description: "JWT authentication token",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
                address: {
                  type: "string",
                  description: "Verified Ethereum wallet address",
                  example: "0x742d35Cc6634C0532925a3b8D",
                },
                user: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "User database ID",
                      example: "507f1f77bcf86cd799439011",
                    },
                    walletAddress: {
                      type: "string",
                      description: "User's wallet address",
                      example: "0x742d35Cc6634C0532925a3b8D",
                    },
                    isNewUser: {
                      type: "boolean",
                      description: "Whether this is a new user registration",
                      example: false,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"], // paths to files containing OpenAPI definitions
};

const specs = swaggerJSDoc(options);

module.exports = {
  specs,
  swaggerUi,
};
