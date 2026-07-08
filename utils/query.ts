import type { Request } from "express";

export const baseQuery = (req: Request) => {
  return {
    page: parseInt(req.query.page as string) || 1,
    take: parseInt(req.query.take as string) || 8,
    sortOrder: (req.query.sortOrder as string) || "asc",
    sortBy: (req.query.sortBy as string) || "startDate",
    search: (req.query.search as string) || "",
  };
};