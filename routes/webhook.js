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

const systemPrompt = `You are Inna, a smart and warm hotel booking assistant. You respond like a real, intelligent human receptionist — not a robot. You understand context, typos, casual language, and natural conversation including Hinglish.

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

BOOKING FLOW - When a customer wants to book:
Collect these details ONE BY ONE conversationally:
1. Full name
2. Check-in date
3. Check-out date
4. Number of rooms
5. Number of guests
6. Room type preference

After collecting all details, show a clear booking summary and confirm.

INTELLIGENCE RULES:
- CRITICAL: Always check full conversation history. If customer already shared name, dates, or any detail — use it directly, NEVER ask again.
- Understand typos, casual language, mixed language
- Parse dates intelligently
- Be warm, friendly, use emojis naturally
- Keep responses concise
- If asked about payment, tell them to scan the QR code that will be sent
- Never make up information not provided above`;

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

// ===== SAVE TO CHAT DB =====
async function saveToChatDB(phone, hotelId, customerId, role, content) {
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
    chat.lastMessage = content;
    chat.time = 'Just now';
    if (role === 'user') chat.unread += 1;
    await chat.save();
    return chat;
  } catch (err) {
    console.error('saveToChatDB error:', err.message);
  }
}

// ===== AI REPLY =====
async function getAIReply(phone, hotelId, customerId, userMessage) {
  try {
    const chat = await Chat.findOne({ phone, hotelId });
    const recentMessages = chat ? chat.messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    })) : [];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
        { role: 'user', content: userMessage }
      ],
      max_tokens: 400,
      temperature: 0.7
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.error('getAIReply error:', err.message);
    return "Sorry, I'm having a little trouble right now! 😅 Please try again in a moment.";
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
  } else {
    return res.sendStatus(403);
  }
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
      userMessage = message.text.body;
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

    console.log(`Incoming: ${userMessage}`);
    console.log(`Phone: ${customerPhone}`);

    // ===== FIND HOTEL =====
    const hotel = await Hotel.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!hotel) {
      console.log('Hotel not found for phoneNumberId:', phoneNumberId);
      return;
    }

    // ===== FIND OR CREATE CUSTOMER =====
    let customer = await Customer.findOneAndUpdate(
      { phone: customerPhone, hotelId: hotel._id },
      { lastSeen: new Date() },
      { upsert: true, new: true }
    );

    // ===== PAYMENT CONFIRMED =====
    if (/^paid|^payment done|^done/i.test(userMessage.trim())) {
      const booking = await Booking.findOne({
        phone: customerPhone,
        status: 'pending'
      }).sort({ createdAt: -1 });

      if (booking) {
        booking.status = 'confirmed';
        await booking.save();
        const reply = `✅ *Payment Received!*\n\n🎉 *Booking Confirmed!*\n🛏️ *Room:* ${booking.roomType}\n📅 *Check-in:* ${new Date(booking.checkIn).toDateString()}\n💰 *Amount:* ₹${booking.totalAmount}\n\n🙏 Thank you for choosing us!\nWe look forward to hosting you! 😊`;
        await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', userMessage);
        await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', reply);
        await sendText(customerPhone, reply, phoneNumberId);
        return;
      }
    }

    // ===== GREETING → Main Menu =====
    if (/^(hi|hii|hiii|hello|hey|helo|good morning|good evening|namaste|start|menu|help)/i.test(userMessage.trim())) {
      const existingChat = await Chat.findOne({ phone: customerPhone, hotelId: hotel._id });
      if (!existingChat || existingChat.messages.length === 0 || /^(menu|start)/i.test(userMessage.trim())) {
        await sendMainMenu(customerPhone, phoneNumberId);
        return;
      }
    }

    // ===== SHOW ROOM PHOTOS =====
    if (/show.*room|room.*photo|room.*pic|see.*room|view.*room|photo|picture|image|show me/i.test(userMessage) ||
        interactiveId === 'menu_rooms') {
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendRoomPhotos(customerPhone, phoneNumberId);
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', 'Sent photos of all rooms.');
      return;
    }

    // ===== PAYMENT QR =====
    if (/pay|payment|qr|online pay|upi|gpay|phonepe|paytm|how to pay|where to pay/i.test(userMessage) ||
        interactiveId === 'menu_pay') {
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendPaymentQR(customerPhone, phoneNumberId);
      await sendText(customerPhone, '📲 Scan the QR above to pay online!\n\nOnce done, just reply *paid* and your booking will be confirmed instantly! ✅', phoneNumberId);
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', 'Sent payment QR code.');
      return;
    }

    // ===== MENU SELECTIONS =====
    if (interactiveId === 'menu_book' || interactiveId === 'photo_book') {
      await sendRoomSelection(customerPhone, phoneNumberId);
      return;
    }

    if (interactiveId === 'menu_checkin') {
      const reply = await getAIReply(customerPhone, hotel._id, customer._id, 'What are the check-in and check-out timings?');
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', reply);
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (interactiveId === 'menu_offers') {
      const reply = await getAIReply(customerPhone, hotel._id, customer._id, 'What special offers do you have?');
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', reply);
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (interactiveId === 'menu_contact') {
      const reply = await getAIReply(customerPhone, hotel._id, customer._id, 'How can I contact the hotel?');
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', reply);
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // ===== ROOM SELECTED → AI booking flow =====
    if (['room_standard', 'room_deluxe', 'room_suite', 'room_other'].includes(interactiveId)) {
      const roomMap = {
        room_standard: 'Standard Room (₹2,500/night)',
        room_deluxe: 'Deluxe Room (₹4,000/night)',
        room_suite: 'Suite (₹7,500/night)',
        room_other: 'Custom Room'
      };
      const selectedRoom = roomMap[interactiveId];
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', `I want to book the ${selectedRoom}`);
      const reply = await getAIReply(customerPhone, hotel._id, customer._id, `I want to book the ${selectedRoom}. Please guide me through the booking.`);
      await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', reply);
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // ===== BOOK KEYWORD =====
    if (/book|reserve|want.*room|need.*room/i.test(userMessage) && !interactiveId) {
      await sendRoomSelection(customerPhone, phoneNumberId);
      return;
    }

    // ===== AI FOR EVERYTHING ELSE =====
    await saveToChatDB(customerPhone, hotel._id, customer._id, 'user', userMessage);
    const reply = await getAIReply(customerPhone, hotel._id, customer._id, userMessage);
    await saveToChatDB(customerPhone, hotel._id, customer._id, 'assistant', reply);
    await sendText(customerPhone, reply, phoneNumberId);

  } catch (error) {
    console.error('Webhook error:', error.message);
  }
});

module.exports = router;