const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Hotel = require("../models/Hotel");
const Customer = require("../models/Customer");

// ===== CREATE BOOKING =====
router.post("/create", async (req, res) => {
  try {
    const {
      guestName,
      phone,
      checkIn,
      checkOut,
      roomType,
      numberOfGuests,
      totalAmount
    } = req.body;

    // 🔥 1. Hotel find
    const hotel = await Hotel.findOne();
    if (!hotel) {
      return res.status(400).json({ error: "Hotel not found" });
    }

    // 🔥 2. Customer find or create
    let customer = await Customer.findOne({ phone });

    if (!customer) {
      customer = await Customer.create({
        phone,
        hotelId: hotel._id
      });
    }

    // 🔥 3. Create booking
    const booking = await Booking.create({
      hotelId: hotel._id,
      customerId: customer._id,
      guestName,
      phone,
      checkIn,
      checkOut,
      roomType,
      numberOfGuests,
      totalAmount,
      status: "pending"
    });

    console.log("Booking:", {
      id: booking._id,
      name: booking.guestName,
      phone: booking.phone,
      room: booking.roomType,
      amount: booking.totalAmount,
      status: booking.status
    });

    return res.json({ booking });

  } catch (err) {
    console.error("Booking error:", err.message);
    return res.status(500).json({ error: "Booking failed" });
  }
});

router.get("/all", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    console.error("Fetch bookings error:", err.message);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});


// ✅ EXPORT
module.exports = router;