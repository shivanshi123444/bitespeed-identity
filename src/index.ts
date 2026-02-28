import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import identifyRouter from "./routes/identify";

dotenv.config();

const app = express();

/* 🔥 VERY IMPORTANT — PUT CORS FIRST */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.use("/identify", identifyRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
