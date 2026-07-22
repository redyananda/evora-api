// Augment Express's Request interface so TypeScript knows about req.user.
// Express 5's Request extends the global Express.Request namespace, so the
// augmentation has to live there — `declare module "express"` does not reach it.

import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}
