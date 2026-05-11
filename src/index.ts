import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import assetsRouter from "./routes/assets";
import assignmentsRouter from "./routes/assignments";
import auditRouter from "./routes/audit";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";

dotenv.config({ path: ".env.local" });

const app = express();
const port = process.env.PORT ?? "5000";

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "*",
  })
);
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/audit", auditRouter);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

app.use(errorHandler);

app.listen(Number(port), () => {
  console.log(`Server listening on port ${port}`);
});
