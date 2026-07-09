import cors from "cors";
import express from "express";
import { eventRoutes } from "./routes/event.routes.js";

const PORT = 8000;

const app = express();

app.use(cors());
app.use(express.json());

// entry point
app.use("/events", eventRoutes);


app.listen(PORT, () => {
  console.log(`Server running on port : ${PORT}`);
}); 