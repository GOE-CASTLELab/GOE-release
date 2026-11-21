// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { closeDatabaseConnection } from "./db";
import { storage } from "./storage";
import { OWNER_ID } from "./ownerGate";
import { startContributionScheduler } from "./contributionScheduler";
import { createApiRequestLogger } from "./apiRequestLogger";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(createApiRequestLogger(log));

(async () => {
  // Add explicit middleware to handle API routes BEFORE Vite
  app.use('/api/*', (req, res, next) => {
    next();
  });

  // Use real routes with AstroApp integration
  const server = await registerRoutes(app);
  
  // Initialize scheduler for daily Current Sky/Transits refresh
  const { initScheduler } = await import('./scheduler');
  initScheduler();
  console.log('Daily astrology data refresh scheduler initialized');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Express error middleware caught error:', err);
    res.status(status).json({ message });
    // Do not throw - this would crash the process
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // Surgical fix: Prevent API routes from being caught by static serving catch-all
    app.use('/api/*', (req, res, next) => {
      // If we reach here, the API route wasn't handled - return 404 instead of HTML
      res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
    });
    
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  startContributionScheduler(storage, OWNER_ID);

  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });

  // Handle graceful shutdown
  const gracefulShutdown = async () => {
    log('Shutting down gracefully');
    return new Promise<void>((resolve) => {
      server.close(async () => {
        log('HTTP server closed');
        await closeDatabaseConnection();
        resolve();
      });
    });
  };

  process.on('SIGTERM', async () => {
    log('SIGTERM received, shutting down gracefully');
    await gracefulShutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log('SIGINT received, shutting down gracefully');
    await gracefulShutdown();
    process.exit(0);
  });

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    
    // Check if it's a recoverable database error
    const isRecoverableDBError = error.message.includes('connection terminated') ||
                                error.message.includes('ECONNRESET') ||
                                (error as any).code === 'ECONNRESET';
    
    if (isRecoverableDBError) {
      console.log('Database connection error detected, allowing pool to reconnect...');
      return; // Don't exit, let the pool handle reconnection
    }
    
    // For truly fatal errors, shut down gracefully
    console.error('Fatal error detected, shutting down');
    await closeDatabaseConnection();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Check if it's a recoverable database error
    const reasonStr = String(reason);
    const isRecoverableDBError = reasonStr.includes('connection terminated') ||
                                reasonStr.includes('ECONNRESET') ||
                                reasonStr.includes('WebSocket');
    
    if (isRecoverableDBError) {
      console.log('Database connection rejection detected, allowing pool to reconnect...');
      return; // Don't exit, let the pool handle reconnection
    }
    
    // For truly fatal rejections, shut down gracefully
    console.error('Fatal rejection detected, shutting down');
    await closeDatabaseConnection();
    process.exit(1);
  });
})();
