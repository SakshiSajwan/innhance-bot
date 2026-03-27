require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const verifyToken = require("./middleware/authMiddleware");
const bookingRoutes = require("./routes/booking");
//const OpenAI = require('openai');


const mongoose = require("mongoose");
const roomsRoute = require("./routes/rooms");

mongoose.connect("mongodb://127.0.0.1:27017/innhance")
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("MongoDB Error ❌", err));

const app = express();
app.use(cors()); 
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use("/rooms", roomsRoute);
app.use("/booking", bookingRoutes);
app.use("/auth", require("./routes/auth"));
app.use("/dashboard", require("./routes/dashboard"));
app.use("/webhook", require("./routes/webhook"));

const PORT = process.env.PORT || 8080;
//const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const META_API_URL = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

const conversations = {};

const roomImages = {
  standard: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  deluxe: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
  suite: 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800'
};

const systemPrompt = `You are Inna, a smart and warm hotel booking assistant for Innhance Hotels. You respond like a real, intelligent human receptionist — not a robot. You understand context, typos, casual language, and natural conversation.

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

BOOKING FLOW - When a customer wants to book:
Collect these details ONE BY ONE in a natural conversational way:
1. Full name
2. Check-in date (understand any format like "25 march", "25/3", "next friday" etc)
3. Check-out date
4. Number of rooms
5. Number of guests
6. Room type preference (if not already selected)

After collecting all details, show a clear booking summary and confirm.

INTELLIGENCE RULES:
- Understand typos, casual language, mixed language (Hinglish is fine)
- If someone says "thanx" or "ok" or "sure" in a booking flow context, understand it's a confirmation or that they meant something
- Parse dates intelligently - "25 march", "25th march 2026", "march 25" all mean the same thing
- If input seems like a typo or correction, handle it gracefully
- Never repeat the same question if the user already answered it
- Be warm, friendly, use emojis naturally but not excessively
- Keep responses concise — don't write essays
- If someone asks about rooms, describe them enthusiastically
- If someone asks to SEE rooms, tell them to type "show rooms" and you'll send photos
- Handle multiple questions in one message intelligently
- If someone is mid-booking and asks an unrelated question, answer it briefly then continue the booking
- Always maintain context from the conversation history

IMPORTANT:
- Never make up information not provided above
- If asked something you don't know, say you'll connect them with the front desk
- Always end responses with a helpful next step or question to keep conversation flowing`;

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
      { id: 'photo_ask', title: '❓ Ask a Question' }
    ]
  );
}

// ===== AI REPLY =====
// async function getAIReply(from, userMessage) {
//   if (!conversations[from]) conversations[from] = [];

//   conversations[from].push({ role: 'user', content: userMessage });

  // Keep last 20 messages for context
//   if (conversations[from].length > 20) {
//     conversations[from] = conversations[from].slice(-20);
//   }

//   const completion = await openai.chat.completions.create({
//     model: 'gpt-4o-mini',
//     messages: [
//       { role: 'system', content: systemPrompt },
//       ...conversations[from]
//     ],
//     max_tokens: 400,
//     temperature: 0.7
//   });

//   const reply = completion.choices[0].message.content;
//   conversations[from].push({ role: 'assistant', content: reply });
//   return reply;
// }

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

// ===== MAIN WEBHOOK =====
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

    // ===== GREETING → Main Menu =====
    if (/^(hi|hii|hiii|hello|hey|helo|good morning|good evening|namaste|start|menu|help)/i.test(userMessage.trim()) && !conversations[from]?.length) {
      await sendMainMenu(from);
      return;
    }

    // ===== SHOW ROOM PHOTOS =====
    if (/show.*room|room.*photo|room.*pic|see.*room|view.*room|photo|picture|image|show me/i.test(userMessage) ||
        interactiveId === 'menu_rooms') {
      await sendRoomPhotos(from);
      // Also add to conversation context
      if (!conversations[from]) conversations[from] = [];
      conversations[from].push({ role: 'user', content: userMessage });
      conversations[from].push({ role: 'assistant', content: 'I sent photos of all our rooms - Standard, Deluxe, and Suite.' });
      return;
    }

    // ===== MENU SELECTIONS → add to AI context =====
    if (interactiveId === 'menu_book' || interactiveId === 'photo_book') {
      await sendRoomSelection(from);
      if (!conversations[from]) conversations[from] = [];
      conversations[from].push({ role: 'user', content: 'I want to book a room' });
      conversations[from].push({ role: 'assistant', content: 'I showed them room selection menu.' });
      return;
    }

    // ===== ROOM SELECTED → AI handles booking flow =====
    if (['room_standard', 'room_deluxe', 'room_suite', 'room_other'].includes(interactiveId)) {
      const roomMap = {
        room_standard: 'Standard Room (₹2,500/night)',
        room_deluxe: 'Deluxe Room (₹4,000/night)',
        room_suite: 'Suite (₹7,500/night)',
        room_other: 'Custom Room'
      };
      const selectedRoom = roomMap[interactiveId];

      if (!conversations[from]) conversations[from] = [];
      conversations[from].push({ role: 'user', content: `I want to book the ${selectedRoom}` });
      conversations[from].push({ role: 'assistant', content: `Customer selected ${selectedRoom}. Now I need to collect: full name, check-in date, check-out date, number of rooms, number of guests.` });

      const reply = await getAIReply(from, `Great, I've selected the ${selectedRoom}. Please guide me through the booking.`);
      await sendText(from, reply);
      return;
    }

    // ===== MENU SHORTCUTS =====
    if (interactiveId === 'menu_checkin') {
      const reply = await getAIReply(from, 'What are the check-in and check-out timings?');
      await sendText(from, reply);
      return;
    }

    if (interactiveId === 'menu_offers') {
      const reply = await getAIReply(from, 'What special offers do you have?');
      await sendText(from, reply);
      return;
    }

    if (interactiveId === 'menu_contact') {
      const reply = await getAIReply(from, 'How can I contact the hotel?');
      await sendText(from, reply);
      return;
    }

    if (interactiveId === 'photo_ask') {
      const reply = await getAIReply(from, 'I have a question about the rooms');
      await sendText(from, reply);
      return;
    }

    // ===== ALL OTHER MESSAGES → AI =====
    const reply = await getAIReply(from, userMessage);
    await sendText(from, reply);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    try {
      const from = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      if (from) await sendText(from, "Sorry, I'm having a little trouble right now! 😅 Please try again in a moment.");
    } catch (e) {}
  }
});

app.get('/', (req, res) => res.send('Innhance Bot is running! 🏨'));

app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    message: "Protected data accessed",
    user: req.user
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
  console.log(`Phone Number ID: ${PHONE_NUMBER_ID ? 'Loaded ✅' : 'Missing ❌'}`);
  console.log(`WhatsApp Token: ${WHATSAPP_TOKEN ? 'Loaded ✅' : 'Missing ❌'}`);
  console.log(`Verify Token: ${VERIFY_TOKEN ? 'Loaded ✅' : 'Missing ❌'}`);
});