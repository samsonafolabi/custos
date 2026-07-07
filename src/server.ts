import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";

import portfolioRouter from "./routes/portfolio";
import disputesRouter from "./routes/disputes";
import agingRouter from "./routes/aging";
import borrowersRouter from "./routes/borrowers";
import webhookRouter from "./routes/webhook";
import balanceRouter from "./routes/balance";
import disbursementsRouter from "./routes/disbursements";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = path.join(__dirname, "..", "src", "public");

// ─── Middleware ───
app.use(express.json({ type: () => true }));
app.use(express.static(PUBLIC_DIR));

// ─── Webhook debug logger ───
app.use((req: Request, res: Response, next) => {
  if (req.path === "/webhooks/nomba") {
    console.log("Webhook received:", {
      method: req.method,
      timestamp: new Date().toISOString(),
      hasSignature: !!req.headers["nomba-signature"],
      hasTimestamp: !!req.headers["nomba-timestamp"],
      eventType: req.body?.event_type ?? req.body?.type ?? "unknown",
      contentLength: req.headers["content-length"],
    });
    if (process.env.DEBUG_WEBHOOK_VERBOSE === "true") {
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("Body:", JSON.stringify(req.body, null, 2));
    }
  }
  next();
});

// ─── Health check ───
app.get("/", (_req: Request, res: Response) => {
  res.send("Custos is alive");
});

// ─── Dashboard ───
app.get("/dashboard", (_req: Request, res: Response) => {
  res.sendFile(path.join(PUBLIC_DIR, "dashboard.html"));
});

// ─── API Routes ───
app.use("/api/portfolio", portfolioRouter);
app.use("/api/disputes", disputesRouter);
app.use("/api/aging", agingRouter);
app.use("/api/borrowers", borrowersRouter);
app.use("/api/balance", balanceRouter);
app.use("/api/disbursements", disbursementsRouter);
app.use("/webhooks", webhookRouter);

// ─── Start ───
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
