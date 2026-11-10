import cors from "cors";
import express from "express";

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "OFFMAP API is running!",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`OFFMAP server running on http://localhost:${PORT}`);
});
