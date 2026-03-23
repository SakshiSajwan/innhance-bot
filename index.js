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
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const META_API_URL = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

const conversations = {};
const sessions = {};

// ===== ROOM IMAGES (replace with your actual hotel images) =====
const roomImages = {
  standard: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  deluxe: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
  suite: 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800'
};

const systemPrompt = `You are Inna, a warm and friendly hotel booking assistant for Innhance Hotels.
You speak naturally and conversationally like a real receptionist.
Use emojis naturally. Keep responses short and helpful.

ROOMS & PRICING:
- Standard Room: ₹2,500/night
- Deluxe Room: ₹4,000/night  
- Suite: ₹7,500/night
- All rooms include FREE breakfast and FREE WiFi

CHECK-IN / CHECK-OUT:
- Check-in: 2:00 PM (early check-in on request)
- Check-out: 11:00 AM (late check-out until 2 PM for ₹500 extra)
- Valid photo ID required

CANCELLATION:
- Free cancellation up to 48 hours before check-in
- 50% charge within 48 hours
- No refund for no-shows

SPECIAL OFFERS:
- Weekend Special: 15% off Deluxe rooms
- Family Package: Kids under 12 stay FREE
- Long Stay: 7 nights = 1 night FREE
- Honeymoon Package: includes dinner + decoration

LOCATION:
- 123 Hotel Street, City Centre
- 15 min from airport, 5 min from railway station
- Free pickup available

CONTACT:
- Phone: +91 98765 43210
- Email: info@innhance.com
- Front desk: 24/7

RULES:
- Be warm, friendly, use emojis naturally
- Keep responses concise
- Never make up info not provided above
- For bookings, guide them to use the menu`;

// ===== SEND TEXT =====
async function sendText(to, message) {
  try {
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
  } catch (error) {
    console.error('sendText error:', error.response?.data || error.message);
  }
}

// ===== SEND IMAGE =====
async function sendImage(to, imageUrl, caption) {
  try {
    await axios.post(META_API_URL, {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: imageUrl, caption }
    }, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('sendImage error:', error.response?.data || error.message);
  }
}

// ===== SEND BUTTONS =====
async function sendButtons(to, bodyText, buttons) {
  try {
    await axios.post(META_API_URL, {
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
    }, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('sendButtons error:', error.response?.data || error.message);
  }
}

// ===== SEND LIST =====
async function sendList(to, bodyText, sections) {
  try {
    await axios.post(META_API_URL, {
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
    }, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('sendList error:', error.response?.data || error.message);
  }
}

// ===== MAIN MENU =====
async function sendMainMenu(to) {
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
    }]
  );
}

// ===== ROOM SELECTION =====
async function sendRoomSelection(to) {
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
    }]
  );
}

// ===== SEND ROOM PHOTOS =====
async function sendRoomPhotos(to) {
  await sendText(to, '📸 Here are our beautiful rooms! 😍');
  await sendImage(to, roomImages.standard,
    '🛏️ *Standard Room* - ₹2,500/night\nCozy & comfortable • Free breakfast & WiFi included');
  await sendImage(to, roomImages.deluxe,
    '✨ *Deluxe Room* - ₹4,000/night\nSpacious with stunning city views • Free breakfast & WiFi included');
  await sendImage(to, roomImages.suite,
    '👑 *Suite* - ₹7,500/night\nThe ultimate luxury experience • Free breakfast & WiFi included');
  await sendButtons(to,
    'Which room catches your eye? 😊',
    [
      { id: 'photo_book', title: '🛏️ Book a Room' },
      { id: 'photo_more', title: '❓ Ask a Question' }
    ]
  );
}

// ===== BOOKING FLOW =====
async function handleBookingFlow(from, msg) {
  const session = sessions[from];

  if (session.step === 'awaiting_name') {
    session.name = msg.trim();
    session.step = 'awaiting_checkin';
    await sendText(from, `Lovely name, *${session.name}*! 😊\n\nWhat's your *check-in date*? 📅\n_(e.g. 25 March 2026)_`);
    return;
  }

  if (session.step === 'awaiting_checkin') {
    session.checkin = msg.trim();
    session.step = 'awaiting_checkout';
    await sendText(from, `Got it! ✅ Check-in on *${session.checkin}*\n\nAnd your *check-out date*? 📅\n_(e.g. 27 March 2026)_`);
    return;
  }

  if (session.step === 'awaiting_checkout') {
    session.checkout = msg.trim();
    session.step = 'awaiting_rooms';
    await sendButtons(from,
      `Perfect! ✅ Check-out on *${session.checkout}*\n\nHow many rooms do you need? 🏨`,
      [
        { id: 'rooms_1', title: '1 Room' },
        { id: 'rooms_2', title: '2 Rooms' },
        { id: 'rooms_3', title: '3+ Rooms' }
      ]
    );
    return;
  }

  if (session.step === 'awaiting_rooms') {
    session.numRooms = msg.trim();
    session.step = 'awaiting_guests';
    await sendButtons(from,
      `Got it! *${session.numRooms}* 🏨\n\nHow many guests in total? 👥`,
      [
        { id: 'guests_1', title: '1 Guest' },
        { id: 'guests_2', title: '2 Guests' },
        { id: 'guests_3', title: '3+ Guests' }
      ]
    );
    return;
  }

  if (session.step === 'awaiting_guests') {
    session.guests = msg.trim();
    session.step = 'confirmed';

    const summary =
      `🎉 *Booking Request Received!*\n\n` +
      `📛 *Name:* ${session.name}\n` +
      `🛏️ *Room:* ${session.room}\n` +
      `🏨 *No. of Rooms:* ${session.numRooms}\n` +
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
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified! ✅');
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

    console.log(`From ${from}: "${userMessage}" (id: ${interactiveId})`);

    // ===== ROOM NUMBER BUTTONS =====
    if (['rooms_1', 'rooms_2', 'rooms_3'].includes(interactiveId)) {
      if (sessions[from] && sessions[from].step === 'awaiting_rooms') {
        await handleBookingFlow(from, userMessage);
        return;
      }
    }

    // ===== GUEST NUMBER BUTTONS =====
    if (['guests_1', 'guests_2', 'guests_3'].includes(interactiveId)) {
      if (sessions[from] && sessions[from].step === 'awaiting_guests') {
        await handleBookingFlow(from, userMessage);
        return;
      }
    }

    // ===== BOOKING FLOW (active session) =====
    if (sessions[from] && sessions[from].step) {
      await handleBookingFlow(from, userMessage);
      return;
    }

    // ===== GREETING =====
    if (/^(hi|hii|hiii|hello|hey|helo|good morning|good evening|namaste|start|menu|help)/i.test(userMessage.trim())) {
      await sendMainMenu(from);
      return;
    }

    // ===== SHOW ROOM PHOTOS =====
    if (/show.*room|room.*photo|room.*picture|see.*room|view.*room|photo|picture|image/i.test(userMessage) ||
        interactiveId === 'menu_rooms' || interactiveId === 'photo_more') {
      await sendRoomPhotos(from);
      return;
    }

    // ===== BOOK =====
    if (interactiveId === 'menu_book' || interactiveId === 'photo_book' ||
        /book|reserve|want.*room|need.*room/i.test(userMessage)) {
      await sendRoomSelection(from);
      return;
    }

    // ===== ROOM SELECTION =====
    if (['room_standard', 'room_deluxe', 'room_suite', 'room_other'].includes(interactiveId)) {
      const roomMap = {
        room_standard: 'Standard Room 🛏️ (₹2,500/night)',
        room_deluxe: 'Deluxe Room ✨ (₹4,000/night)',
        room_suite: 'Suite 👑 (₹7,500/night)',
        room_other: 'Custom Room'
      };
      sessions[from] = { step: 'awaiting_name', room: roomMap[interactiveId] };
      await sendText(from, `Excellent choice! 🎉 You've selected *${roomMap[interactiveId]}*!\n\nLet's complete your booking! What's your *full name*? 📛`);
      return;
    }

    // ===== CHECK IN/OUT =====
    if (interactiveId === 'menu_checkin') {
      await sendButtons(from,
        `⏰ *Check-in & Check-out:*\n\n✅ Check-in: 2:00 PM\n✅ Check-out: 11:00 AM\n🌅 Early check-in available on request\n🕑 Late check-out until 2 PM (+₹500)\n🪪 Valid photo ID required at check-in`,
        [
          { id: 'ci_book', title: '🛏️ Book a Room' },
          { id: 'ci_offers', title: '🎁 View Offers' },
          { id: 'ci_contact', title: '📞 Contact Us' }
        ]
      );
      return;
    }

    if (interactiveId === 'ci_book') { await sendRoomSelection(from); return; }
    if (interactiveId === 'ci_offers') {
      await sendText(from, `🎁 *Special Offers:*\n\n🌟 Weekend Special: 15% off Deluxe!\n👨‍👩‍👧 Family Package: Kids under 12 FREE!\n📅 Long Stay: 7 nights = 1 FREE!\n💑 Honeymoon: Dinner + decoration!\n\nReply *book* to grab a deal! 😊`);
      return;
    }
    if (interactiveId === 'ci_contact') {
      await sendText(from, `📞 *Contact Us:*\n\n📱 +91 98765 43210\n📧 info@innhance.com\n⏰ 24/7 Front desk!`);
      return;
    }

    // ===== OFFERS =====
    if (interactiveId === 'menu_offers') {
      await sendButtons(from,
        `🎁 *Special Offers:*\n\n🌟 Weekend Special: 15% off Deluxe!\n👨‍👩‍👧 Family Package: Kids under 12 FREE!\n📅 Long Stay: 7 nights = 1 FREE!\n💑 Honeymoon Package: Dinner + decoration!`,
        [
          { id: 'offer_book', title: '🛏️ Book Now' },
          { id: 'offer_rooms', title: '🏨 View Rooms' }
        ]
      );
      return;
    }

    if (interactiveId === 'offer_book') { await sendRoomSelection(from); return; }
    if (interactiveId === 'offer_rooms') { await sendRoomPhotos(from); return; }

    // ===== CONTACT =====
    if (interactiveId === 'menu_contact') {
      await sendText(from, `📞 *Contact Innhance Hotels:*\n\n📱 Phone: +91 98765 43210\n📧 Email: info@innhance.com\n📍 123 Hotel Street, City Centre\n⏰ Front desk: Available 24/7!\n\nWe're always here for you! 💙`);
      return;
    }

    // ===== AI FOR EVERYTHING ELSE =====
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
  console.log(`Phone Number ID: ${PHONE_NUMBER_ID ? 'Loaded ✅' : 'Missing ❌'}`);
  console.log(`WhatsApp Token: ${WHATSAPP_TOKEN ? 'Loaded ✅' : 'Missing ❌'}`);
  console.log(`Verify Token: ${VERIFY_TOKEN ? 'Loaded ✅' : 'Missing ❌'}`);
});