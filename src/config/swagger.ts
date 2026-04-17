import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Anonymous Chat API",
      version: "1.0.0",
      description: "Документация API для бэкенда Anonymous Chat",
      contact: {
        name: "Поддержка API",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: "Сервер разработки",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/**/*.ts", "./src/app.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
