import express from "express";

const router = express.Router();

router.get("/ping", (req, res) => {
  res.status(200).json({ message: "Pong", time: Date.now() });
});

export default router;