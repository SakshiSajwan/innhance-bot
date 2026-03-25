const express = require('express');
const router = express.Router();
const axios = require('axios');

const Hotel = require('../models/Hotel');
const Customer = require('../models/Customer');
const Conversation = require('../models/Conversation');
const Booking = require('../models/Booking');


// ===== VERIFY WEBHOOK =====
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified ✅');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});


// ===== MAIN WEBHOOK =====
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    // ===============================
    // 🔥 MANUAL TEST MODE
    // ===============================
    if (body.phone && body.message) {
      const userMessage = body.message.toLowerCase();
      const customerPhone = body.phone;

      console.log("Manual hit:", userMessage, customerPhone);

      if (userMessage.includes("paid") || userMessage.includes("done")) {

        const booking = await Booking.findOne({
          phone: customerPhone,
          status: "pending"
        }).sort({ createdAt: -1 });

        console.log("Matched booking:", booking);

        if (booking) {
          booking.status = "confirmed";
          await booking.save();

          console.log("✅ Payment received:", booking);
        }
      }

      return res.sendStatus(200);
    }


    // ===============================
    // 📱 WHATSAPP FLOW
    // ===============================
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return res.sendStatus(200);
    }

    const userMessage = message.text.body.toLowerCase();
    const customerPhone = message.from;
    const phoneNumberId = value.metadata.phone_number_id;

    console.log("Incoming:", userMessage);
    console.log("Phone:", customerPhone);


    // ===============================
    // 💰 PAYMENT DETECTION
    // ===============================
    if (userMessage.includes("paid") || userMessage.includes("done")) {

      const booking = await Booking.findOne({
        phone: customerPhone,
        status: "pending"
      }).sort({ createdAt: -1 });

      console.log("Matched booking:", booking);

      if (booking) {
        booking.status = "confirmed";
        await booking.save();

        console.log("✅ Payment confirmed:", booking);

        const reply = `✅ Payment Received!

🎉 *Booking Confirmed*
🛏 *Room:* ${booking.roomType}
💰 *Amount:* ₹${booking.totalAmount}

🙏 Thank you for choosing us!
We look forward to hosting you 😊`;

        await sendWhatsAppMessage(customerPhone, reply, phoneNumberId);
      }

      return res.sendStatus(200);
    }


    // ===============================
    // 🤖 NORMAL CHAT FLOW
    // ===============================
    const hotel = await Hotel.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!hotel) return res.sendStatus(200);

    let customer = await Customer.findOne({
      phone: customerPhone,
      hotelId: hotel._id
    });

    if (!customer) {
      customer = await Customer.create({
        phone: customerPhone,
        hotelId: hotel._id
      });
    } else {
      customer.lastSeen = new Date();
      await customer.save();
    }

    let conversation = await Conversation.findOne({
      phone: customerPhone,
      hotelId: hotel._id
    });

    if (!conversation) {
      conversation = await Conversation.create({
        phone: customerPhone,
        hotelId: hotel._id,
        customerId: customer._id,
        messages: [],
        bookingState: { inProgress: false, collectedData: {} }
      });
    }

    // Save user message
    conversation.messages.push({
      role: 'user',
      content: userMessage
    });

    // Temporary reply
    let botReply = "Thanks for your message 😊";

// 👇 HI / HELLO
if (userMessage.includes("hi") || userMessage.includes("hello")) {
  botReply = "Hi! Welcome to our hotel 😊\nType 'book' to make a booking.";
}

// 👇 BOOK FLOW
else if (userMessage.includes("book")) {
  botReply = "Great! Your booking is being created...";

  const booking = await Booking.create({
    hotelId: hotel._id,
    customerId: customer._id,
    guestName: "Guest",
    phone: customerPhone,
    checkIn: new Date(),
    checkOut: new Date(),
    roomType: "Standard Room",
    numberOfGuests: 2,
    totalAmount: 1000,
    status: "pending"
  });

  console.log("Auto booking created:", booking);
}

    await conversation.save();

    await sendWhatsAppMessage(customerPhone, botReply, phoneNumberId);

    return res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error.message);
    return res.sendStatus(200);
  }
});


// ===== SEND WHATSAPP MESSAGE =====
async function sendWhatsAppMessage(to, message, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    console.error("Send error:", err.message);
  }
}

module.exports = router;