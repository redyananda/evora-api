// Augment Express's Request interface so TypeScript knows about req.user
// This file is auto-included via tsconfig.json "typeRoots" / "include" settings.

import "express";

declare module "express" {
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
