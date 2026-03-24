const express = require("express");
const router = express.Router();

// temporary memory
let bookings = [];

router.post("/create", (req, res) => {
  const { name, phone, room, amount } = req.body;

  const booking = {
    id: "INN" + Math.floor(Math.random() * 100000),
    name,
    phone,
    room,
    amount,
    status: "pending",
  };

  bookings.push(booking);

  console.log("Booking:", booking);

  res.json({ booking });
});

module.exports = { router, bookings };