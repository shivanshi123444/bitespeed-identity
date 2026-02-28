import express from "express";
import dotenv from "dotenv";
import identifyRouter from "./routes/identify";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/identify", identifyRouter);

app.listen(3000, () => {
  console.log("Server running on port 3000 🚀");
});
