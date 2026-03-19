const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const twilio = require('twilio');
const Hotel = require('../models/Hotel');
const Customer = require('../models/Customer');
const Conversation = require('../models/Conversation');
const Booking = require('../models/Booking');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

router.post('/', async (req, res) => {
  console.log('=== INCOMING MESSAGE ===');
  console.log('FROM:', req.body.From);
  console.log('TO:', req.body.To);
  console.log('BODY:', req.body.Body);
  console.log('========================');

  const userMessage = req.body.Body;
  const customerPhone = req.body.From;
  const hotelPhone = req.body.To;

  if (!userMessage) return res.status(400).json({ error: 'No message provided' });

  try {
    // 1. Find hotel
    const hotel = await Hotel.findOne({ whatsappNumber: hotelPhone });
    if (!hotel) {
      console.log('No hotel found for number:', hotelPhone);
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>This number is not registered.</Message></Response>`);
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
    const updatedData = extractBookingData(userMessage, botReply, collected);
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
    const imagesToSend = getImagesToSend(userMessage, hotel.images);

    // 9. Send images first if needed
    if (imagesToSend.length > 0) {
      for (const imageUrl of imagesToSend) {
        await twilioClient.messages.create({
          from: hotelPhone,
          to: customerPhone,
          mediaUrl: [imageUrl]
        });
      }
    }

    // 10. Send text reply
    console.log(`[${hotel.name}] ${customerPhone}: ${userMessage}`);
    console.log(`[${hotel.name}] Bot: ${botReply}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${botReply}</Message>
</Response>`;
    res.set('Content-Type', 'text/xml');
    res.send(twiml);

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, having trouble right now! 😅 Please try again.</Message></Response>`);
  }
});

function getImagesToSend(message, images) {
  if (!images) return [];
  const text = message.toLowerCase();
  const toSend = [];

  const isRoomInquiry = text.includes('room') || text.includes('book') ||
    text.includes('stay') || text.includes('suite') ||
    text.includes('deluxe') || text.includes('standard') ||
    text.includes('photo') || text.includes('picture') ||
    text.includes('show') || text.includes('look') ||
    text.includes('price') || text.includes('cost') ||
    text.includes('available');

  if (!isRoomInquiry) return [];

  if (text.includes('standard') && images.standardRoom) {
    toSend.push(images.standardRoom);
  } else if (text.includes('deluxe') && images.deluxeRoom) {
    toSend.push(images.deluxeRoom);
  } else if (text.includes('suite') && images.suite) {
    toSend.push(images.suite);
  } else {
    if (images.lobby) toSend.push(images.lobby);
    if (images.standardRoom) toSend.push(images.standardRoom);
    if (images.deluxeRoom) toSend.push(images.deluxeRoom);
    if (images.suite) toSend.push(images.suite);
  }

  return toSend;
}

function extractBookingData(userMessage, botReply, existing = {}) {
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

function isBookingComplete(data) {
  return data.name && data.checkIn && data.checkOut && data.roomType && data.numberOfGuests;
}

module.exports = router;