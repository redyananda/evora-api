import "dotenv/config";
import cors from "cors";
import express from "express";
import { eventRoutes } from "./routes/event.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { profileRoutes } from "./routes/profile.routes.js";

const PORT = process.env.PORT || 8000;

const app = express();

app.use(cors());
app.use(express.json({ limit: "3mb" }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/events", eventRoutes);
app.use("/profile", profileRoutes);

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port : ${PORT}`);
});
