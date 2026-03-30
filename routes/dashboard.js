const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Dashboard API working" });
});

router.get("/bookings", (req, res) => {
  res.json([
    { id: 1, name: "John", status: "confirmed" },
    { id: 2, name: "Rahul", status: "pending" }
  ]);
});

module.exports = router;