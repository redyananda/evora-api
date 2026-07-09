import type { Request, Response } from "express";
import { getEventBySlugService, getEventsService } from "../services/events.service.js";
import { baseQuery } from "../utils/query.js";

export const getEventsController = async (req: Request, res: Response) => {
    const query = baseQuery(req);
      const result = await getEventsService(query);
      res.status(200).send(result)
}

export const getEventBySlugController = async(req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const result = await getEventBySlugService(slug);
    res.status(200).send(result)
}