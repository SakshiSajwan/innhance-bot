require('dotenv').config();
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const META_API_URL = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

// ===== CONVERSATION MEMORY =====
const conversations = {};
const sessions = {};

// ===== SYSTEM PROMPT =====
const systemPrompt = `You are Inna, a warm and friendly hotel booking assistant for Innhance Hotels.
You speak in a natural, human, conversational way — like a real receptionist, not a robot.
You use emojis naturally in your responses to make them feel warm and friendly.
Keep responses concise and clear — not too long.

Here is everything you know about Innhance Hotels:

ROOMS & PRICING:
- Standard Room: ₹2,500/night (perfect for solo travelers or couples)
- Deluxe Room: ₹4,000/night (spacious with beautiful view)
- Suite: ₹7,500/night (ultimate luxury experience)
- All rooms include FREE breakfast and FREE WiFi

CHECK-IN / CHECK-OUT:
- Check-in: 2:00 PM (early check-in available on request)
- Check-out: 11:00 AM (late check-out until 2 PM for ₹500 extra)
- Valid photo ID required at check-in

AMENITIES (all free for guests):
- Swimming Pool: 6 AM - 10 PM
- Fully Equipped Gym: 24/7
- Spa & Wellness Centre: 9 AM - 8 PM
- Free high-speed WiFi everywhere
- Free parking (valet at ₹200/day)
- 24/7 room service

RESTAURANT:
- Breakfast: 7 AM - 10 AM (FREE for guests)
- Lunch: 12 PM - 3 PM
- Dinner: 7 PM - 11 PM
- Cuisines: Indian, Continental, Chinese

CANCELLATION POLICY:
- Free cancellation up to 48 hours before check-in
- 50% charge within 48 hours
- No refund for no-shows

SPECIAL OFFERS:
- Weekend Special: 15% off Deluxe rooms
- Family Package: Kids under 12 stay FREE
- Long Stay Deal: 7 nights = 1 night FREE
- Honeymoon Package: includes dinner + decoration

LOCATION:
- Address: 123 Hotel Street, City Centre
- 15 minutes from airport, 5 minutes from railway station
- Free pickup available

CONTACT:
- Phone: +91 98765 43210
- Email: info@innhance.com
- Front desk: 24/7

IMPORTANT RULES:
- Always be warm, friendly and use emojis naturally
- Keep responses short and conversational
- Never make up information not provided above
- When someone wants to book, tell them to use the booking menu`;

// ===== SEND PLAIN TEXT =====
async function sendText(to, message) {
  await axios.post(META_API_URL, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message }
  }, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

// ===== SEND INTERACTIVE BUTTONS =====
async function sendButtons(to, bodyText, buttons) {
  await axios.post(META_API_URL, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn, i) => ({
          type: 'reply',
          reply: { id: `btn_${i}`, title: btn }
        }))
      }
    }
  }, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

// ===== SEND LIST MESSAGE =====
async function sendList(to, bodyText, sections) {
  await axios.post(META_API_URL, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: '🏨 View Options',
        sections
      }
    }
  }, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

// ===== SEND ROOM SELECTION LIST =====
async function sendRoomSelection(to) {
  await sendList(to,
    '🏨 *Welcome to Innhance Hotels!*\n\nPlease select a room type to book:',
    [{
      title: 'Our Rooms',
      rows: [
        { id: 'room_standard', title: '🛏️ Standard Room', description: '₹2,500/night • Free breakfast & WiFi' },
        { id: 'room_deluxe', title: '✨ Deluxe Room', description: '₹4,000/night • Beautiful view' },
        { id: 'room_suite', title: '👑 Suite', description: '₹7,500/night • Ultimate luxury' },
        { id: 'room_other', title: '✏️ Other / Custom', description: 'Describe your preference' }
      ]
    }]
  );
}

// ===== SEND MAIN MENU =====
async function sendMainMenu(to) {
  await sendList(to,
    '👋 *Welcome to Innhance Hotels!*\n\nHow can I help you today?',
    [{
      title: 'What would you like to do?',
      rows: [
        { id: 'menu_book', title: '🛏️ Book a Room', description: 'Reserve your stay' },
        { id: 'menu_rooms', title: '🏨 View Rooms & Prices', description: 'See all available rooms' },
        { id: 'menu_amenities', title: '🏊 Amenities', description: 'Pool, gym, spa & more' },
        { id: 'menu_checkin', title: '⏰ Check-in / Check-out', description: 'Timings & policies' },
        { id: 'menu_contact', title: '📞 Contact Us', description: 'Get in touch' },
        { id: 'menu_offers', title: '🎁 Special Offers', description: 'Deals & discounts' }
      ]
    }]
  );
}

// ===== HANDLE BOOKING FLOW =====
async function handleBookingFlow(from, msg) {
  const session = sessions[from];

  if (session.step === 'awaiting_name') {
    session.name = msg;
    session.step = 'awaiting_checkin';
    await sendText(from, `Lovely name, *${session.name}*! 😊\n\nWhat's your *check-in date*? 📅\n_(e.g. 25 March 2026)_`);
    return;
  }

  if (session.step === 'awaiting_checkin') {
    session.checkin = msg;
    session.step = 'awaiting_checkout';
    await sendText(from, `Got it! ✅ Check-in on *${session.checkin}*\n\nAnd your *check-out date*? 📅\n_(e.g. 27 March 2026)_`);
    return;
  }

  if (session.step === 'awaiting_checkout') {
    session.checkout = msg;
    session.step = 'awaiting_guests';
    await sendButtons(from,
      `Perfect! ✅ Check-out on *${session.checkout}*\n\nHow many guests will be staying? 👥`,
      ['1 Guest', '2 Guests', '3+ Guests']
    );
    return;
  }

  if (session.step === 'awaiting_guests') {
    session.guests = msg;
    session.step = 'confirmed';

    const summary = `🎉 *Booking Request Received!*\n\n` +
      `📛 *Name:* ${session.name}\n` +
      `🛏️ *Room:* ${session.room}\n` +
      `📅 *Check-in:* ${session.checkin}\n` +
      `📅 *Check-out:* ${session.checkout}\n` +
      `👥 *Guests:* ${session.guests}\n\n` +
      `✅ Our team will call you within *15 minutes* to confirm!\n` +
      `📞 Please keep your phone reachable.\n\n` +
      `Thank you for choosing *Innhance Hotels!* 🏨✨`;

    await sendText(from, summary);
    delete sessions[from];
    return;
  }
}

// ===== WEBHOOK VERIFICATION =====
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'innhance_verify_token';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ===== WEBHOOK HANDLER =====
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return;

    const from = message.from;
    let userMessage = '';
    let interactiveId = '';

    // Handle different message types
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

    console.log(`Message from ${from}: ${userMessage} (id: ${interactiveId})`);

    // ===== HANDLE INTERACTIVE SELECTIONS =====

    // Main menu selections
    if (interactiveId === 'menu_book' || /book|reserve|room|stay/i.test(userMessage) && !sessions[from]) {
      await sendRoomSelection(from);
      return;
    }

    // Room selections — start booking flow
    if (['room_standard', 'room_deluxe', 'room_suite', 'room_other'].includes(interactiveId)) {
      const roomMap = {
        room_standard: 'Standard Room 🛏️ (₹2,500/night)',
        room_deluxe: 'Deluxe Room ✨ (₹4,000/night)',
        room_suite: 'Suite 👑 (₹7,500/night)',
        room_other: 'Custom Room'
      };
      sessions[from] = { step: 'awaiting_name', room: roomMap[interactiveId] };

      if (interactiveId === 'room_other') {
        await sendText(from, `No problem! 😊 Please describe the type of room you're looking for and we'll do our best to accommodate you!\n\nBut first, what's your *full name*? 📛`);
      } else {
        await sendText(from, `Excellent choice! 🎉 You've selected the *${roomMap[interactiveId]}*!\n\nLet's complete your booking. What's your *full name*? 📛`);
      }
      return;
    }

    // Menu quick options
    if (interactiveId === 'menu_rooms') {
      await sendText(from, `🏨 *Our Rooms & Pricing:*\n\n🛏️ *Standard Room* - ₹2,500/night\nPerfect for solo travelers or couples!\n\n✨ *Deluxe Room* - ₹4,000/night\nSpacious with a beautiful view!\n\n👑 *Suite* - ₹7,500/night\nThe ultimate luxury experience!\n\n✅ All rooms include FREE breakfast & WiFi!\n\nWant to book? Reply *book* anytime! 😊`);
      return;
    }

    if (interactiveId === 'menu_amenities') {
      await sendText(from, `🌟 *Our Amenities (All FREE!):*\n\n🏊 Swimming Pool — 6 AM to 10 PM\n💪 Gym — Open 24/7\n💆 Spa & Wellness — 9 AM to 8 PM\n🍽️ Restaurant — All day dining\n🅿️ Free Parking\n📶 High-speed WiFi everywhere\n🛎️ 24/7 Room Service\n\nAnything else I can help with? 😊`);
      return;
    }

    if (interactiveId === 'menu_checkin') {
      await sendButtons(from,
        `⏰ *Check-in & Check-out:*\n\n✅ Check-in: 2:00 PM\n✅ Check-out: 11:00 AM\n🌅 Early check-in available on request\n🕑 Late check-out until 2 PM (+₹500)\n🪪 Valid photo ID required`,
        ['Book a Room', 'View Offers', 'Contact Us']
      );
      return;
    }

    if (interactiveId === 'menu_contact') {
      await sendText(from, `📞 *Contact Innhance Hotels:*\n\n📱 Phone: +91 98765 43210\n📧 Email: info@innhance.com\n📍 123 Hotel Street, City Centre\n⏰ Front desk: 24/7!\n\nWe're always here for you! 💙`);
      return;
    }

    if (interactiveId === 'menu_offers') {
      await sendText(from, `🎁 *Special Offers:*\n\n🌟 Weekend Special: 15% off Deluxe!\n👨‍👩‍👧 Family Package: Kids under 12 FREE!\n📅 Long Stay: 7 nights = 1 FREE!\n💑 Honeymoon: Dinner + decoration!\n\nWant to grab any deal? Reply *book* to get started! 😊`);
      return;
    }

    // ===== BOOKING FLOW =====
    if (sessions[from] && sessions[from].step) {
      await handleBookingFlow(from, userMessage);
      return;
    }

    // ===== GREETING — show main menu =====
    const isGreeting = /^(hi|hii|hiii|hello|hey|helo|good morning|good evening|good afternoon|namaste|start|menu)/i.test(userMessage.trim());
    if (isGreeting) {
      await sendMainMenu(from);
      return;
    }

    // ===== AI for everything else =====
    if (!conversations[from]) conversations[from] = [];
    conversations[from].push({ role: 'user', content: userMessage });
    if (conversations[from].length > 10) conversations[from] = conversations[from].slice(-10);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversations[from]
      ],
      max_tokens: 300
    });

    const botReply = completion.choices[0].message.content;
    conversations[from].push({ role: 'assistant', content: botReply });

    await sendText(from, botReply);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
});

app.get('/', (req, res) => res.send('Innhance Bot is running! 🏨'));

app.listen(PORT, () => console.log(`Server running on port ${PORT} ✅`));