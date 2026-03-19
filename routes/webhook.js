const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const Hotel = require('../models/Hotel');
const Customer = require('../models/Customer');
const Conversation = require('../models/Conversation');
const Booking = require('../models/Booking');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== VERIFY WEBHOOK =====
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified ✅');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ===== RECEIVE MESSAGES =====
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return res.sendStatus(200);
    }

    const userMessage = message.text.body;
    const customerPhone = message.from;
    const hotelPhoneNumberId = value.metadata.phone_number_id;

    console.log('=== INCOMING MESSAGE ===');
    console.log('FROM:', customerPhone);
    console.log('PHONE_NUMBER_ID:', hotelPhoneNumberId);
    console.log('BODY:', userMessage);
    console.log('========================');

    // 1. Find hotel
    const hotel = await Hotel.findOne({ whatsappPhoneNumberId: hotelPhoneNumberId });
    if (!hotel) {
      console.log('No hotel found for phone number ID:', hotelPhoneNumberId);
      return res.sendStatus(200);
    }

    // 2. Find or create customer
    let customer = await Customer.findOne({ phone: customerPhone, hotelId: hotel._id });
    if (!customer) {
      customer = await Customer.create({ phone: customerPhone, hotelId: hotel._id });
    } else {
      customer.lastSeen = new Date();
      await customer.save();
    }

    // 3. Find or create conversation
    let conversation = await Conversation.findOne({ phone: customerPhone, hotelId: hotel._id });
    if (!conversation) {
      conversation = await Conversation.create({
        phone: customerPhone,
        hotelId: hotel._id,
        customerId: customer._id,
        messages: [],
        bookingState: { inProgress: false, collectedData: {} }
      });
    }

    // 4. Add user message
    conversation.messages.push({ role: 'user', content: userMessage });
    const recentMessages = conversation.messages.slice(-10);

    // 5. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: hotel.botConfig.systemPrompt },
        ...recentMessages.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 300
    });

    const botReply = completion.choices[0].message.content;

    // 6. Save bot reply
    conversation.messages.push({ role: 'assistant', content: botReply });

    // 7. Check booking completion
    const collected = conversation.bookingState.collectedData || {};
    const updatedData = extractBookingData(userMessage, collected);
    conversation.bookingState.collectedData = updatedData;

    if (isBookingComplete(updatedData) && !conversation.bookingState.saved) {
      await Booking.create({
        hotelId: hotel._id,
        customerId: customer._id,
        guestName: updatedData.name,
        phone: customerPhone,
        checkIn: new Date(updatedData.checkIn),
        checkOut: new Date(updatedData.checkOut),
        roomType: updatedData.roomType,
        numberOfGuests: updatedData.numberOfGuests,
        status: 'confirmed',
        source: 'whatsapp'
      });
      customer.totalBookings += 1;
      await customer.save();
      conversation.bookingState.saved = true;
    }

    await conversation.save();

    // 8. Check if images should be sent
    const imagesToSend = getImagesToSend(userMessage, botReply, hotel.images);

    // 9. Send intro + images if needed
    if (imagesToSend.length > 0) {
      // Send intro message before images
      await sendWhatsAppMessage(
        customerPhone,
        '🏨 Here are some pictures of our beautiful rooms! Take a look 😊',
        hotelPhoneNumberId
      );

      // Send each image
      for (const imageUrl of imagesToSend) {
        await sendWhatsAppImage(customerPhone, imageUrl, hotelPhoneNumberId);
      }
    }

    // 10. Send bot text reply
    await sendWhatsAppMessage(customerPhone, botReply, hotelPhoneNumberId);

    console.log(`[${hotel.name}] Bot: ${botReply}`);
    res.sendStatus(200);

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.sendStatus(200);
  }
});

// ===== SEND TEXT MESSAGE =====
async function sendWhatsAppMessage(to, message, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Text send error:', err.message);
  }
}

// ===== SEND IMAGE MESSAGE =====
async function sendWhatsAppImage(to, imageUrl, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'image',
        image: { link: imageUrl }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Image send error:', err.message);
  }
}

// ===== DETECT ROOM IMAGES TO SEND =====
function getImagesToSend(userMessage, botReply, images) {
  if (!images) return [];
  const text = userMessage.toLowerCase();
  const reply = botReply.toLowerCase();

  // Only send images if BOTH user asked about rooms AND bot is replying about rooms
  const isRoomContext =
    (text.includes('room') || text.includes('suite') ||
     text.includes('deluxe') || text.includes('standard') ||
     text.includes('photo') || text.includes('picture') ||
     text.includes('show') || text.includes('look') ||
     text.includes('what do') || text.includes('how does')) &&
    (reply.includes('room') || reply.includes('suite') ||
     reply.includes('deluxe') || reply.includes('standard') ||
     reply.includes('₹') || reply.includes('night'));

  if (!isRoomContext) return [];

  const toSend = [];

  if (text.includes('standard') && images.standardRoom) {
    toSend.push(images.standardRoom);
  } else if (text.includes('deluxe') && images.deluxeRoom) {
    toSend.push(images.deluxeRoom);
  } else if (text.includes('suite') && images.suite) {
    toSend.push(images.suite);
  } else {
    // General room inquiry — send all
    if (images.lobby) toSend.push(images.lobby);
    if (images.standardRoom) toSend.push(images.standardRoom);
    if (images.deluxeRoom) toSend.push(images.deluxeRoom);
    if (images.suite) toSend.push(images.suite);
  }

  return toSend;
}

// ===== EXTRACT BOOKING DATA =====
function extractBookingData(userMessage, existing = {}) {
  const data = { ...existing };
  const text = userMessage.toLowerCase();

  const nameMatch = userMessage.match(/(?:name is|i am|i'm)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
  if (nameMatch) data.name = nameMatch[1];

  const datePattern = /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi;
  const dates = userMessage.match(datePattern);
  if (dates && dates.length >= 2) {
    data.checkIn = dates[0];
    data.checkOut = dates[1];
  } else if (dates && dates.length === 1) {
    if (!data.checkIn) data.checkIn = dates[0];
    else if (!data.checkOut) data.checkOut = dates[0];
  }

  const guestMatch = text.match(/(\d+)\s*(?:guests?|people|persons?|adults?)/);
  if (guestMatch) data.numberOfGuests = parseInt(guestMatch[1]);

  if (text.includes('standard')) data.roomType = 'Standard';
  if (text.includes('deluxe')) data.roomType = 'Deluxe';
  if (text.includes('suite')) data.roomType = 'Suite';

  return data;
}

// ===== CHECK BOOKING COMPLETE =====
function isBookingComplete(data) {
  return data.name && data.checkIn && data.checkOut && data.roomType && data.numberOfGuests;
}

module.exports = router;