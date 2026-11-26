import express from "express";
import routes from "./routes/index.js";

const app = express();
app.use(express.json());
app.get("/", (_req, res) => res.type("text").send("Blog API is running."));
app.use("/api", routes);
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  const invalid = ["ValidationError", "CastError"].includes(error.name);
  res.status(invalid ? 400 : 500).json({ message: invalid ? error.message : "Unexpected server error" });
});

export default app;
