const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const OpenAI  = require('openai');

const Hotel    = require('../models/Hotel');
const Customer = require('../models/Customer');
const Chat     = require('../models/Chat');
const Booking  = require('../models/Booking');

const openai         = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PAYMENT_QR_URL = 'https://i.ibb.co/b5dPnbs1/qr.jpg';

const roomImages = {
  standard: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  deluxe:   'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
  suite:    'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800',
};

const ROOM_CAPACITY = {
  'Standard Room': { maxAdults: 2, maxTotal: 3 },
  'Deluxe Room':   { maxAdults: 3, maxTotal: 4 },
  'Suite':         { maxAdults: 4, maxTotal: 6 },
};

const PAYMENT_RECEIVER_NAME = 'Arnav Prabhakar';

// ============================================================
// SYSTEM PROMPT (unchanged - kept as you had)
// ============================================================
const SYSTEM_PROMPT = `...`; // ← Keep your full SYSTEM_PROMPT here exactly as it is (I didn't paste it again to save space, but keep it)


// ============================================================
// SEND FUNCTIONS (unchanged)
// ============================================================
async function sendText(to, message, phoneNumberId) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', to, type: 'text', text: { body: message }
    }, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('❌ sendText error:', err.response?.data || err.message);
  }
}

async function sendImage(to, imageUrl, caption, phoneNumberId) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', to, type: 'image', image: { link: imageUrl, caption }
    }, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('❌ sendImage error:', err.response?.data || err.message);
  }
}

// Keep all your other send functions (sendButtons, sendList, etc.) as they are...

// Keep fetchWhatsAppMediaAsBase64 and verifyPaymentScreenshot exactly as they are...

// Keep all menu functions, saveMessage, getHistory, isFirstMessage, detectPreferredLanguage, looksLikeQuestion, validateCapacity, getSmartReply exactly as they are...

// Keep tryExtractAndSaveBooking exactly as it is...

// ============================================================
// MAIN WEBHOOK - FIXED VERSION
// ============================================================
router.post('/', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    if (value?.statuses || !value?.messages) return;

    const message = value.messages[0];
    const phoneNumberId = value.metadata?.phone_number_id;
    const customerPhone = message.from;

    if (customerPhone === phoneNumberId) return;

    const hotel = await Hotel.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!hotel) return;

    const customer = await Customer.findOneAndUpdate(
      { phone: customerPhone, hotelId: hotel._id },
      { lastSeen: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    // ====================== IMAGE HANDLER (Payment Screenshot) ======================
    if (message.type === 'image') {
      const mediaId = message.image?.id;
      if (!mediaId) {
        await sendText(customerPhone, "I couldn't read that image. Please try again! 📸", phoneNumberId);
        return;
      }

      // CRITICAL FIX: Search with hotelId
      const booking = await Booking.findOne({ 
        phone: customerPhone, 
        hotelId: hotel._id, 
        status: 'pending' 
      }).sort({ createdAt: -1 });

      if (!booking) {
        await sendText(customerPhone, "I don't see a pending booking to verify payment for. Would you like to make a booking? 😊", phoneNumberId);
        return;
      }

      await sendText(customerPhone, '🔍 Verifying your payment screenshot, please wait a moment...', phoneNumberId);

      const media = await fetchWhatsAppMediaAsBase64(mediaId);
      if (!media) {
        await sendText(customerPhone, "Sorry, I couldn't download your screenshot. Please try again! 📸", phoneNumberId);
        return;
      }

      const result = await verifyPaymentScreenshot(media.base64, media.mimeType, booking.totalAmount, PAYMENT_RECEIVER_NAME);

      if (result.verified) {
        booking.status = 'confirmed';
        await booking.save();

        const nights = Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
        const confirmMsg = `🎉 Payment Verified & Booking Confirmed!\n\nName: ${booking.guestName}\nRoom: ${booking.roomType}\nCheck-in: ${new Date(booking.checkIn).toLocaleDateString('en-IN')}\nGuests: ${booking.numberOfGuests}\nAmount: ₹${booking.totalAmount}\n\nThank you! See you soon 😊`;

        await sendText(customerPhone, confirmMsg, phoneNumberId);
      } else {
        let failReason = "Payment verification failed. ";
        if (!result.isSuccess) failReason += "Transaction not successful. ";
        else if (!result.nameMatch) failReason += `Receiver must be ${PAYMENT_RECEIVER_NAME}. `;
        else if (!result.amountMatch) failReason += `Amount doesn't match. `;
        await sendText(customerPhone, failReason + "Please send correct screenshot again.", phoneNumberId);
      }
      return;
    }

    // ====================== TEXT & INTERACTIVE HANDLING ======================
    let userMessage = '';
    let interactiveId = '';

    if (message.type === 'text') userMessage = message.text.body.trim();
    else if (message.type === 'interactive') {
      if (message.interactive.type === 'button_reply') {
        interactiveId = message.interactive.button_reply.id;
        userMessage = message.interactive.button_reply.title;
      } else if (message.interactive.type === 'list_reply') {
        interactiveId = message.interactive.list_reply.id;
        userMessage = message.interactive.list_reply.title;
      }
    }

    if (!userMessage) return;

    // Your existing handlers for menu, greetings, shortcuts... (keep them as is)

    // ... (paste all your HANDLER 1 to HANDLER 4 here - I kept them unchanged in your original file)

    // FINAL HANDLER - Smart AI + Force Booking Creation
    const reply = await getSmartReply(customerPhone, hotel._id, customer._id, userMessage);
    await sendText(customerPhone, reply, phoneNumberId);

    // FORCE extract & save booking after every AI reply
    const history = await getHistory(customerPhone, hotel._id);
    const savedBooking = await tryExtractAndSaveBooking(customerPhone, hotel._id, customer._id, history);

    // If booking summary was shown, send QR immediately
    const lowerReply = reply.toLowerCase();
    if (lowerReply.includes('summary') || lowerReply.includes('total') || (lowerReply.includes('confirm') && lowerReply.includes('₹'))) {
      if (savedBooking) {
        await sendPaymentQR(customerPhone, phoneNumberId, savedBooking.totalAmount);
        await sendText(customerPhone, `💳 Scan the QR and pay ₹${savedBooking.totalAmount} to ${PAYMENT_RECEIVER_NAME}\n\nThen send screenshot for instant confirmation! 📸`, phoneNumberId);
      }
    }

  } catch (err) {
    console.error('❌ Webhook error:', err.message);
  }
});

router.get('/', (req, res) => {
  // your verify token code
});

module.exports = router;