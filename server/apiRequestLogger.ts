import type { RequestHandler } from "express";

type LogWriter = (message: string) => void;
type Clock = () => number;

export function formatApiRequestLog(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
): string {
  return `${method} ${path} ${statusCode} in ${durationMs}ms`;
}

export function createApiRequestLogger(
  writeLog: LogWriter,
  now: Clock = Date.now,
): RequestHandler {
  return (req, res, next) => {
    const start = now();
    const path = req.path;

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;
      writeLog(
        formatApiRequestLog(
          req.method,
          path,
          res.statusCode,
          Math.max(0, now() - start),
        ),
      );
    });

    next();
  };
}
