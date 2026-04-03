const express = require('express');
const router  = express.Router();
const QRCode  = require('qrcode');         // npm install qrcode
const Hotel   = require('../models/Hotel');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

// ================================================================
// CONFIG — Arnav's UPI ID (all payments come here)
// ================================================================
const PLATFORM_UPI_ID   = process.env.PLATFORM_UPI_ID   || 'arnav@okicici';
const PLATFORM_UPI_NAME = process.env.PLATFORM_UPI_NAME || 'Arnav Prabhakar';

// ================================================================
// HELPER: Build UPI deep link
// Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR&tn=NOTE
// ================================================================
function buildUpiLink({ upiId, upiName, amount, transactionNote }) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: upiName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: transactionNote,
  });
  return `upi://pay?${params.toString()}`;
}

// ================================================================
// HELPER: Generate transaction note
// Format: HOTEL-{SHORT_CODE}-BOOK-{BOOKING_REF}
// ================================================================
function buildTransactionNote(hotelCode, bookingRef) {
  return `HOTEL-${hotelCode}-BOOK-${bookingRef}`;
}

// ================================================================
// POST /api/payments/generate-qr
// ================================================================
router.post('/generate-qr', async (req, res) => {
  try {
    const { bookingId, hotelId } = req.body;

    const [booking, hotel] = await Promise.all([
      Booking.findById(bookingId),
      Hotel.findById(hotelId),
    ]);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!hotel)   return res.status(404).json({ error: 'Hotel not found'   });

    const bookingRef      = booking._id.toString().slice(-6).toUpperCase();
    const hotelCode       = hotel.shortCode || hotel._id.toString().slice(-6).toUpperCase();
    const transactionNote = buildTransactionNote(hotelCode, bookingRef);

    const upiLink = buildUpiLink({
      upiId:           PLATFORM_UPI_ID,
      upiName:         PLATFORM_UPI_NAME,
      amount:          booking.totalAmount,
      transactionNote,
    });

    const qrDataUrl = await QRCode.toDataURL(upiLink, {
      width:           400,
      margin:          2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    await Payment.findOneAndUpdate(
      { bookingId: booking._id },
      {
        hotelId:         hotel._id,
        hotelName:       hotel.name,
        bookingId:       booking._id,
        bookingRef,
        customerPhone:   booking.phone,
        guestName:       booking.guestName,
        amount:          booking.totalAmount,
        transactionNote,
        status:          'pending',
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      qrDataUrl,
      upiLink,
      transactionNote,
      amount:          booking.totalAmount,
      bookingRef,
    });

  } catch (err) {
    console.error('❌ generate-qr error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// POST /api/payments/verify-screenshot
// ================================================================
router.post('/verify-screenshot', async (req, res) => {
  try {
    const { bookingId, transactionId, paidAt, amountPaid, verified } = req.body;

    const payment = await Payment.findOne({ bookingId });
    if (!payment) return res.status(404).json({ error: 'Payment record not found' });

    payment.transactionId       = transactionId || null;
    payment.paidAt              = paidAt        || null;
    payment.screenshotVerified  = verified;
    payment.status              = verified ? 'verified' : 'failed';
    await payment.save();

    res.json({ success: true, payment });
  } catch (err) {
    console.error('❌ verify-screenshot error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// GET /api/payments/dashboard
// ================================================================
router.get('/dashboard', async (req, res) => {
  try {
    const { status, from, to, hotelId } = req.query;

    const filter = {};
    if (status)  filter.status  = status;
    if (hotelId) filter.hotelId = hotelId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const hotelSummary = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id:            '$hotelId',
          hotelName:      { $first: '$hotelName' },
          totalPayments: { $sum: 1 },
          totalAmount:   { $sum: '$amount' },
          verified:      { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } },
          settled:       { $sum: { $cond: [{ $eq: ['$status', 'settled'] }, 1, 0] } },
          pending:       { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          pendingAmount: {
            $sum: {
              $cond: [{ $in: ['$status', ['verified', 'pending']] }, '$amount', 0],
            },
          },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const totals = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id:           null,
          totalRevenue:  { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          unsettled:     {
            $sum: {
              $cond: [{ $eq: ['$status', 'verified'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    const recent = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      totals:  totals[0] || { totalRevenue: 0, totalPayments: 0, unsettled: 0 },
      hotels:  hotelSummary,
      recent,
    });

  } catch (err) {
    console.error('❌ dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// PATCH /api/payments/:paymentId/settle
// ================================================================
router.patch('/:paymentId/settle', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    payment.status      = 'settled';
    payment.settledAt   = new Date();
    payment.settledNote = req.body.note || '';
    await payment.save();

    res.json({ success: true, payment });
  } catch (err) {
    console.error('❌ settle error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// GET /api/payments/hotel/:hotelId
// ================================================================
router.get('/hotel/:hotelId', async (req, res) => {
  try {
    const payments = await Payment.find({ hotelId: req.params.hotelId })
      .sort({ createdAt: -1 })
      .lean();

    const totalReceived = payments
      .filter(p => ['verified', 'settled'].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalSettled = payments
      .filter(p => p.status === 'settled')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      payments,
      summary: {
        totalReceived,
        totalSettled,
        pendingSettlement: totalReceived - totalSettled,
      },
    });
  } catch (err) {
    console.error('❌ hotel payments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Attach helper functions to the router safely
router.buildUpiLink         = buildUpiLink;
router.buildTransactionNote = buildTransactionNote;
router.PLATFORM_UPI_ID      = PLATFORM_UPI_ID;
router.PLATFORM_UPI_NAME    = PLATFORM_UPI_NAME;

module.exports = router;