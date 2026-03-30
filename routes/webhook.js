const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');

const Hotel = require('../models/Hotel');
const Customer = require('../models/Customer');
const Chat = require('../models/Chat');
const Booking = require('../models/Booking');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const roomImages = {
  standard: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  deluxe: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
  suite: 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800'
};

const PAYMENT_QR_URL = 'https://i.ibb.co/b5dPnbs1/qr.jpg';

const systemPrompt = `You are Inna, a smart and warm hotel booking assistant for Innhance Hotels. You respond like a real, intelligent human receptionist — not a robot. You understand context, typos, casual language, and natural conversation including Hinglish.

HOTEL INFORMATION:
Rooms & Pricing:
- Standard Room: ₹2,500/night (cozy, perfect for solo travelers or couples)
- Deluxe Room: ₹4,000/night (spacious with beautiful city views)
- Suite: ₹7,500/night (ultimate luxury with premium facilities)
- All rooms include FREE breakfast and FREE WiFi

Check-in / Check-out:
- Check-in: 2:00 PM (early check-in available on request)
- Check-out: 11:00 AM (late check-out until 2 PM for ₹500 extra)
- Valid photo ID required at check-in

Cancellation Policy:
- Free cancellation up to 48 hours before check-in
- 50% charge for cancellation within 48 hours
- No refund for no-shows

Special Offers:
- Weekend Special: 15% off Deluxe rooms
- Family Package: Kids under 12 stay FREE
- Long Stay Deal: 7 nights = 1 night FREE
- Honeymoon Package: includes romantic dinner + room decoration

Location:
- 123 Hotel Street, City Centre
- 15 minutes from airport, 5 minutes from railway station
- Free pickup available on request

Contact:
- Phone: +91 98765 43210
- Email: info@innhance.com
- Front desk available 24/7

Payment:
- UPI/QR code payment available online
- Cash and cards accepted at hotel during check-in
- After scanning QR and paying, customer should reply "paid" to confirm booking

BOOKING FLOW - Collect these details ONE BY ONE conversationally:
1. Full name
2. Check-in date (ask for DD/MM/YYYY format)
3. Check-out date (ask for DD/MM/YYYY format)
4. Number of rooms
5. Number of guests
6. Room type preference (if not already selected)

After collecting ALL details, show a clear booking summary and ask to confirm.

CRITICAL INTELLIGENCE RULES:
- ALWAYS read the ENTIRE conversation history above before responding
- If customer already gave their name — USE IT, never ask again
- If customer already gave dates — USE THEM, never ask again
- If any detail was already shared earlier in conversation — never ask for it again
- You are continuing an existing conversation, not starting fresh
- Never greet the customer again if conversation is already ongoing
- Never say "Hi" or "Hello" if customer has already been greeted
- Understand typos, casual language, mixed language (Hinglish)
- Parse dates intelligently (22nd march, 22/03, march 22 — all valid)
- Be warm, friendly, use emojis naturally
- Keep responses concise and helpful
- If asked about payment, tell them to scan the QR code that will be sent`;

// ===== SEND TEXT =====
async function sendText(to, message, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('sendText error:', err.response?.data || err.message);
  }
}

// ===== SEND IMAGE =====
async function sendImage(to, imageUrl, caption, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'image',
        image: { link: imageUrl, caption }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('sendImage error:', err.response?.data || err.message);
  }
}

// ===== SEND BUTTONS =====
async function sendButtons(to, bodyText, buttons, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title }
            }))
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('sendButtons error:', err.response?.data || err.message);
  }
}

// ===== SEND LIST =====
async function sendList(to, bodyText, sections, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: '👇 View Options',
            sections
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('sendList error:', err.response?.data || err.message);
  }
}

// ===== SEND MAIN MENU =====
async function sendMainMenu(to, phoneNumberId) {
  await sendList(to,
    '👋 *Welcome to Innhance Hotels!*\n\nHow can I help you today?',
    [{
      title: 'How can we help?',
      rows: [
        { id: 'menu_book', title: '🛏️ Book a Room', description: 'Reserve your stay with us' },
        { id: 'menu_rooms', title: '🏨 View Rooms', description: 'See rooms with photos & prices' },
        { id: 'menu_checkin', title: '⏰ Check-in/Check-out', description: 'Timings & policies' },
        { id: 'menu_offers', title: '🎁 Special Offers', description: 'Deals & discounts' },
        { id: 'menu_contact', title: '📞 Contact Us', description: 'Get in touch with us' }
      ]
    }],
    phoneNumberId
  );
}

// ===== SEND ROOM SELECTION =====
async function sendRoomSelection(to, phoneNumberId) {
  await sendList(to,
    '🏨 *Choose your room type:*\n\nAll rooms include FREE breakfast & WiFi! 🍳📶',
    [{
      title: 'Our Rooms',
      rows: [
        { id: 'room_standard', title: '🛏️ Standard Room', description: '₹2,500/night • Perfect for couples' },
        { id: 'room_deluxe', title: '✨ Deluxe Room', description: '₹4,000/night • Beautiful view' },
        { id: 'room_suite', title: '👑 Suite', description: '₹7,500/night • Ultimate luxury' },
        { id: 'room_other', title: '✏️ Other / Custom', description: 'Describe your preference' }
      ]
    }],
    phoneNumberId
  );
}

// ===== SEND ROOM PHOTOS =====
async function sendRoomPhotos(to, phoneNumberId) {
  await sendText(to, '📸 Here are our beautiful rooms! 😍', phoneNumberId);
  await sendImage(to, roomImages.standard, '🛏️ *Standard Room* - ₹2,500/night\nCozy & comfortable • Free breakfast & WiFi included', phoneNumberId);
  await sendImage(to, roomImages.deluxe, '✨ *Deluxe Room* - ₹4,000/night\nSpacious with stunning city views • Free breakfast & WiFi included', phoneNumberId);
  await sendImage(to, roomImages.suite, '👑 *Suite* - ₹7,500/night\nThe ultimate luxury experience • Free breakfast & WiFi included', phoneNumberId);
  await sendButtons(to,
    'Which room catches your eye? 😊',
    [
      { id: 'photo_book', title: '🛏️ Book a Room' },
      { id: 'photo_ask', title: '❓ Ask a Question' }
    ],
    phoneNumberId
  );
}

// ===== SEND PAYMENT QR =====
async function sendPaymentQR(to, phoneNumberId) {
  await sendImage(to,
    PAYMENT_QR_URL,
    '💳 *Payment QR Code*\n\nScan this QR to pay online! 😊\n\n✅ Once payment is done, reply *paid* to confirm your booking!',
    phoneNumberId
  );
}

// ===== SAVE MESSAGE TO DB =====
async function saveMessage(phone, hotelId, customerId, role, content) {
  try {
    let chat = await Chat.findOne({ phone, hotelId });
    if (!chat) {
      chat = new Chat({
        phone,
        hotelId,
        customerId,
        name: 'Guest ' + phone.slice(-4),
        avatar: 'G',
        messages: []
      });
    }
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    chat.messages.push({ role, content, time });
    chat.lastMessage = content.substring(0, 100);
    chat.time = 'Just now';
    if (role === 'user') chat.unread = (chat.unread || 0) + 1;
    await chat.save();
    return chat;
  } catch (err) {
    console.error('saveMessage error:', err.message);
  }
}

// ===== GET FULL HISTORY =====
async function getChatHistory(phone, hotelId) {
  try {
    const chat = await Chat.findOne({ phone, hotelId });
    if (!chat || !chat.messages.length) return [];
    // Return last 30 messages for context
    return chat.messages.slice(-30).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
  } catch (err) {
    console.error('getChatHistory error:', err.message);
    return [];
  }
}

// ===== AI REPLY — saves BEFORE calling AI so history is complete =====
async function getAIReply(phone, hotelId, customerId, userMessage) {
  try {
    // Step 1: Save user message first
    await saveMessage(phone, hotelId, customerId, 'user', userMessage);

    // Step 2: Get full history INCLUDING the message just saved
    const history = await getChatHistory(phone, hotelId);

    // Step 3: Call AI with complete history
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content;

    // Step 4: Save AI reply
    await saveMessage(phone, hotelId, customerId, 'assistant', reply);

    return reply;
  } catch (err) {
    console.error('getAIReply error:', err.message);
    return "Sorry, I'm having a little trouble right now! 😅 Please try again in a moment.";
  }
}

// ===== CHECK IF CONVERSATION IS NEW =====
async function isNewConversation(phone, hotelId) {
  try {
    const chat = await Chat.findOne({ phone, hotelId });
    return !chat || chat.messages.length === 0;
  } catch (err) {
    return true;
  }
}

// ===== VERIFY WEBHOOK =====
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified ✅');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===== MAIN WEBHOOK =====
router.post('/', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return;

    const phoneNumberId = value.metadata.phone_number_id;
    const customerPhone = message.from;
    let userMessage = '';
    let interactiveId = '';

    if (message.type === 'text') {
      userMessage = message.text.body.trim();
    } else if (message.type === 'interactive') {
      if (message.interactive.type === 'button_reply') {
        interactiveId = message.interactive.button_reply.id;
        userMessage = message.interactive.button_reply.title;
      } else if (message.interactive.type === 'list_reply') {
        interactiveId = message.interactive.list_reply.id;
        userMessage = message.interactive.list_reply.title;
      }
    }

    if (!userMessage) return;

    console.log(`📩 From: ${customerPhone} | Message: ${userMessage} | ID: ${interactiveId}`);

    // ===== FIND HOTEL =====
    const hotel = await Hotel.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!hotel) {
      console.log('❌ Hotel not found for phoneNumberId:', phoneNumberId);
      return;
    }

    // ===== FIND OR CREATE CUSTOMER =====
    let customer = await Customer.findOneAndUpdate(
      { phone: customerPhone, hotelId: hotel._id },
      { lastSeen: new Date() },
      { upsert: true, new: true }
    );

    // ===== PAYMENT CONFIRMED =====
    if (/^(paid|payment done|done|payment complete|completed)/i.test(userMessage)) {
      const booking = await Booking.findOne({
        phone: customerPhone,
        status: 'pending'
      }).sort({ createdAt: -1 });

      if (booking) {
        booking.status = 'confirmed';
        await booking.save();
        const reply = `✅ *Payment Received & Booking Confirmed!* 🎉\n\n🛏️ *Room:* ${booking.roomType}\n📅 *Check-in:* ${new Date(booking.checkIn).toDateString()}\n💰 *Amount:* ₹${booking.totalAmount}\n\n🙏 Thank you for choosing Innhance Hotels!\nWe look forward to hosting you! 😊`;
        await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
        await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', reply);
        await sendText(customerPhone, reply, phoneNumberId);
        return;
      }
    }

    // ===== GREETING → Show menu ONLY for brand new conversations =====
    const isNew = await isNewConversation(customerPhone, hotel._id);
    const isGreeting = /^(hi|hii|hiii|hello|hey|helo|good morning|good evening|namaste)\b/i.test(userMessage);
    const isMenuRequest = /^(start|menu|help|main menu)/i.test(userMessage);

    if (isMenuRequest || (isGreeting && isNew)) {
      // Save the greeting
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendMainMenu(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', 'Sent main menu');
      return;
    }

    // ===== SHOW ROOM PHOTOS =====
    if (
      /show.*room|room.*photo|room.*pic|see.*room|view.*room|photo|picture|image|show me/i.test(userMessage) ||
      interactiveId === 'menu_rooms'
    ) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendRoomPhotos(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', 'Sent room photos');
      return;
    }

    // ===== PAYMENT QR =====
    if (
      /^(pay|payment|qr|online pay|upi|gpay|phonepe|paytm|how to pay|where to pay)/i.test(userMessage) ||
      interactiveId === 'menu_pay'
    ) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendPaymentQR(customerPhone, phoneNumberId);
      await sendText(customerPhone, '📲 Scan the QR above to pay online!\n\nOnce done, just reply *paid* and your booking will be confirmed instantly! ✅', phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', 'Sent payment QR code');
      return;
    }

    // ===== MENU SELECTIONS =====
    if (interactiveId === 'menu_book' || interactiveId === 'photo_book') {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendRoomSelection(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', 'Sent room selection menu');
      return;
    }

    if (interactiveId === 'menu_checkin') {
      const reply = await getAIReply(customerPhone, hotel._id, customer._id, 'What are the check-in and check-out timings and policies?');
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (interactiveId === 'menu_offers') {
      const reply = await getAIReply(customerPhone, hotel._id, customer._id, 'Tell me about all your special offers and deals');
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (interactiveId === 'menu_contact') {
      const reply = await getAIReply(customerPhone, hotel._id, customer._id, 'How can I contact the hotel?');
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // ===== ROOM SELECTED → Start booking flow with AI =====
    if (['room_standard', 'room_deluxe', 'room_suite', 'room_other'].includes(interactiveId)) {
      const roomMap = {
        room_standard: 'Standard Room (₹2,500/night)',
        room_deluxe: 'Deluxe Room (₹4,000/night)',
        room_suite: 'Suite (₹7,500/night)',
        room_other: 'Custom preference'
      };
      const selectedRoom = roomMap[interactiveId];
      // getAIReply handles saving user message + getting history + saving reply
      const reply = await getAIReply(
        customerPhone, hotel._id, customer._id,
        `I want to book the ${selectedRoom}`
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // ===== BOOK KEYWORD (text, not interactive) =====
    if (/\b(book|reserve|booking)\b/i.test(userMessage) && !interactiveId) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendRoomSelection(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', 'Sent room selection menu');
      return;
    }

    // ===== ALL OTHER MESSAGES → AI handles with full history =====
    const reply = await getAIReply(customerPhone, hotel._id, customer._id, userMessage);
    await sendText(customerPhone, reply, phoneNumberId);

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
  }
});

module.exports = router;