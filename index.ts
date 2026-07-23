import "dotenv/config";
import cors from "cors";
import express from "express";
import { eventRoutes } from "./routes/event.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { profileRoutes } from "./routes/profile.routes.js";
import { transactionRoutes } from "./routes/transaction.routes.js";
import { organizerRoutes } from "./routes/organizer.routes.js";
import { sweepStaleTransactionsService } from "./services/transaction.service.js";

const PORT = process.env.PORT || 8000;

// Auto-expire unpaid orders and auto-cancel orders the organizer never acted on.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const runStaleTransactionSweep = async () => {
  try {
    const { expired, canceled } = await sweepStaleTransactionsService();
    if (expired || canceled) {
      console.log(`[Sweep] expired=${expired} canceled=${canceled}`);
    }
  } catch (error) {
    console.error("[Sweep] failed", error);
  }
};

const app = express();

app.use(cors());
app.use(express.json({ limit: "3mb" }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/events", eventRoutes);
app.use("/profile", profileRoutes);
app.use("/transactions", transactionRoutes);
app.use("/organizer", organizerRoutes);

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port : ${PORT}`);
  void runStaleTransactionSweep();
  setInterval(runStaleTransactionSweep, SWEEP_INTERVAL_MS);
});
