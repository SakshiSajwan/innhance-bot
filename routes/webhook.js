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

// ============================================================
// MASTER SYSTEM PROMPT — Smart, context-aware, never repeats
// ============================================================
const SYSTEM_PROMPT = `You are Inna, the AI receptionist for Innhance Hotels. You are warm, smart, witty, and speak like a real human — not a robot. You handle everything: answering questions, booking rooms, taking payments, and helping guests.

═══════════════════════════════════
HOTEL INFORMATION
═══════════════════════════════════
Rooms & Pricing:
- Standard Room — ₹2,500/night | Cozy, perfect for solo or couple stays
- Deluxe Room — ₹4,000/night | Spacious with beautiful city views
- Suite — ₹7,500/night | Ultimate luxury, premium facilities
- All rooms include FREE breakfast + FREE WiFi

Timings:
- Check-in: 2:00 PM (early check-in on request)
- Check-out: 11:00 AM (late check-out till 2 PM for ₹500 extra)
- Valid photo ID required at check-in

Cancellation Policy:
- Free cancellation up to 48 hours before check-in
- 50% charge if cancelled within 48 hours
- No refund for no-shows

Special Offers:
- Weekend Special: 15% off Deluxe rooms (Fri-Sun)
- Family Package: Kids under 12 stay FREE
- Long Stay Deal: Book 7 nights, get 1 night FREE
- Honeymoon Package: Romantic dinner + room decoration included

Location & Transport:
- 123 Hotel Street, City Centre
- 15 min from airport | 5 min from railway station
- Free airport/station pickup available on request

Contact:
- Phone: +91 98765 43210
- Email: info@innhance.com
- Front desk: 24/7

Payment:
- Online: UPI/QR code (we send the QR, customer scans and pays)
- At hotel: Cash, Credit/Debit cards
- After paying online, customer replies "paid" to confirm

═══════════════════════════════════
BOOKING FLOW
═══════════════════════════════════
When a customer wants to book, collect these ONE BY ONE naturally:
1. Full name
2. Check-in date (DD/MM/YYYY)
3. Check-out date (DD/MM/YYYY)
4. Number of rooms
5. Number of guests
6. Room type (if not already chosen)

Once all 6 details are collected, show a beautiful booking summary and ask for confirmation.
After confirmation, tell them the payment QR will be sent and ask them to reply "paid" once done.

═══════════════════════════════════
YOUR PERSONALITY & INTELLIGENCE RULES
═══════════════════════════════════
CONTEXT RULES (MOST IMPORTANT):
- Read the ENTIRE conversation history before every response
- If name/dates/room type was already given — NEVER ask again
- You are CONTINUING a conversation — not starting fresh
- Never say "Hi", "Hello", or re-greet if the conversation is ongoing
- Never repeat information the customer already gave you
- If customer gives multiple details at once, acknowledge all of them

LANGUAGE & TONE:
- Understand Hinglish, typos, casual language naturally
- "kal" = tomorrow, "parso" = day after tomorrow
- "2 log" = 2 guests, "teen raat" = 3 nights
- Parse dates in any format: "22nd march", "22/3", "march 22", "kal" etc.
- Use emojis naturally but don't overdo it
- Keep responses SHORT and conversational — max 3-4 lines unless showing summary
- Never use bullet points for casual replies — only for summaries

SMART BEHAVIOUR:
- If someone says "deluxe" after being asked room type — understand it's the room choice
- If someone gives their name when asked — move to the NEXT question immediately
- If someone asks a general question mid-booking — answer it and then continue booking
- If someone seems confused — gently guide them
- If someone is rude or frustrated — be extra polite and helpful
- Always move the conversation FORWARD — never get stuck

LANGUAGE RULES:
- Detect the language the customer is writing in and ALWAYS reply in the SAME language
- If customer writes in Hindi — reply in Hindi
- If customer writes in Hinglish — reply in Hinglish  
- If customer writes in Gujarati — reply in Gujarati
- If customer writes in Marathi — reply in Marathi
- If customer writes in Tamil — reply in Tamil
- If customer writes in Telugu — reply in Telugu
- If customer writes in Bengali — reply in Bengali
- If customer writes in Kannada — reply in Kannada
- If customer writes in Punjabi — reply in Punjabi
- If customer writes in Malayalam — reply in Malayalam
- If customer writes in Arabic — reply in Arabic
- If customer writes in French, Spanish, German or any other language — reply in that language
- For all Indian languages you can use the Roman script (English letters) version if customer is using that
- Example: Customer writes "mujhe room book karna hai" → reply in Hinglish
- Example: Customer writes "મને રૂમ જોઈએ છે" → reply in Gujarati
- Example: Customer writes "முறை பண்ண வேண்டும்" → reply in Tamil
- NEVER switch languages mid-conversation unless customer switches first
- Keep all prices, room names and hotel info the same — just the language changes

NEVER DO:
- Never ask for a detail you already have
- Never greet again mid-conversation  
- Never say "I'm just an AI" or "I don't have access to"
- Never make up prices or policies not listed above
- Never send the same message twice
- Never ask "How can I help you?" when you already know what they want`;

// ============================================================
// WHATSAPP SEND FUNCTIONS
// ============================================================

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
    console.error('❌ sendText error:', err.response?.data || err.message);
  }
}

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
    console.error('❌ sendImage error:', err.response?.data || err.message);
  }
}

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
            buttons: buttons.map(btn => ({
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
    console.error('❌ sendButtons error:', err.response?.data || err.message);
  }
}

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
    console.error('❌ sendList error:', err.response?.data || err.message);
  }
}

// ============================================================
// MENU FUNCTIONS
// ============================================================

async function sendMainMenu(to, phoneNumberId) {
  await sendList(
    to,
    '👋 *Welcome to Innhance Hotels!*\n\nI\'m Inna, your personal hotel assistant. How can I help you today? 😊',
    [{
      title: 'What can we help with?',
      rows: [
        { id: 'menu_book', title: '🛏️ Book a Room', description: 'Reserve your perfect stay' },
        { id: 'menu_rooms', title: '🏨 View Rooms & Photos', description: 'See all rooms with prices' },
        { id: 'menu_offers', title: '🎁 Special Offers', description: 'Deals & discounts available' },
        { id: 'menu_checkin', title: '⏰ Timings & Policies', description: 'Check-in, check-out & more' },
        { id: 'menu_contact', title: '📞 Contact Us', description: 'Reach our team directly' }
      ]
    }],
    phoneNumberId
  );
}

async function sendRoomMenu(to, phoneNumberId) {
  await sendList(
    to,
    '🏨 *Choose your room type:*\n\n✅ All rooms include FREE breakfast & WiFi!',
    [{
      title: 'Available Rooms',
      rows: [
        { id: 'room_standard', title: '🛏️ Standard — ₹2,500/night', description: 'Cozy & comfortable' },
        { id: 'room_deluxe', title: '✨ Deluxe — ₹4,000/night', description: 'Spacious with city view' },
        { id: 'room_suite', title: '👑 Suite — ₹7,500/night', description: 'Ultimate luxury' }
      ]
    }],
    phoneNumberId
  );
}

async function sendRoomPhotos(to, phoneNumberId) {
  await sendText(to, '📸 *Here\'s a look at our beautiful rooms!* 😍', phoneNumberId);
  await sendImage(to, roomImages.standard, '🛏️ *Standard Room* — ₹2,500/night\nCozy & comfortable | Free breakfast & WiFi ✅', phoneNumberId);
  await sendImage(to, roomImages.deluxe, '✨ *Deluxe Room* — ₹4,000/night\nSpacious with stunning city views | Free breakfast & WiFi ✅', phoneNumberId);
  await sendImage(to, roomImages.suite, '👑 *Suite* — ₹7,500/night\nUltimate luxury experience | Free breakfast & WiFi ✅', phoneNumberId);
  await sendButtons(
    to,
    'Which room would you like to book? 😊',
    [
      { id: 'photo_book', title: '🛏️ Book a Room' },
      { id: 'photo_ask', title: '❓ Ask a Question' }
    ],
    phoneNumberId
  );
}

async function sendPaymentQR(to, phoneNumberId) {
  await sendImage(
    to,
    PAYMENT_QR_URL,
    '💳 *Scan to Pay Online*\n\nOnce payment is done, reply *paid* to confirm your booking instantly! ✅',
    phoneNumberId
  );
}

// ============================================================
// DATABASE FUNCTIONS
// ============================================================

async function saveMessage(phone, hotelId, customerId, role, content) {
  try {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    let chat = await Chat.findOne({ phone, hotelId });
    
    if (!chat) {
      chat = new Chat({
        phone,
        hotelId,
        customerId,
        name: 'Guest ' + phone.slice(-4),
        avatar: 'G',
        messages: [],
        unread: 0
      });
    }

    chat.messages.push({ role, content, time });
    chat.lastMessage = content.substring(0, 120);
    chat.time = 'Just now';
    if (role === 'user') chat.unread = (chat.unread || 0) + 1;
    
    await chat.save();
    return chat;
  } catch (err) {
    console.error('❌ saveMessage error:', err.message);
  }
}

async function getHistory(phone, hotelId) {
  try {
    const chat = await Chat.findOne({ phone, hotelId });
    if (!chat || !chat.messages || chat.messages.length === 0) return [];
    
    // Get last 40 messages for rich context
    return chat.messages.slice(-40).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
  } catch (err) {
    console.error('❌ getHistory error:', err.message);
    return [];
  }
}

async function isFirstMessage(phone, hotelId) {
  try {
    const chat = await Chat.findOne({ phone, hotelId });
    return !chat || !chat.messages || chat.messages.length === 0;
  } catch (err) {
    return true;
  }
}

// ============================================================
// CORE AI FUNCTION
// Saves user message → gets history → calls AI → saves reply
// ============================================================
async function getSmartReply(phone, hotelId, customerId, userMessage, contextHint = null) {
  try {
    // Step 1: Save user message to DB
    await saveMessage(phone, hotelId, customerId, 'user', userMessage);

    // Step 2: Get complete history (now includes the message just saved)
    const history = await getHistory(phone, hotelId);

    // Step 3: Build messages for OpenAI
    // If there's a context hint (e.g. menu selection), inject it
    let messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    
    if (contextHint) {
      // Add context hint as a system note before history
      messages.push({
        role: 'system',
        content: `[CONTEXT NOTE: ${contextHint}]`
      });
    }
    
    messages = [...messages, ...history];

    // Step 4: Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',           // Using gpt-4o for maximum intelligence
      messages,
      max_tokens: 600,
      temperature: 0.75,
      presence_penalty: 0.3,    // Discourages repeating the same phrases
      frequency_penalty: 0.3    // Discourages repetitive words
    });

    const reply = completion.choices[0].message.content.trim();

    // Step 5: Save AI reply to DB
    await saveMessage(phone, hotelId, customerId, 'assistant', reply);

    return reply;
  } catch (err) {
    console.error('❌ getSmartReply error:', err.message);
    return "Oops, I ran into a little issue! 😅 Give me a moment and try again please.";
  }
}

// ============================================================
// PARSE BOOKING DETAILS FROM CONVERSATION (for auto-save)
// ============================================================
async function tryExtractAndSaveBooking(phone, hotelId, customerId, history) {
  try {
    // Ask AI to extract booking details from conversation
    const extractPrompt = `Look at this conversation and extract booking details if all are present.
Return ONLY a JSON object with these exact keys, or return null if any detail is missing:
{
  "guestName": "full name",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD", 
  "roomType": "Standard Room / Deluxe Room / Suite",
  "numberOfGuests": 2,
  "numberOfRooms": 1
}

Return null if any field is missing or unclear.
Return ONLY the JSON, no explanation.

Conversation:
${history.map(m => `${m.role}: ${m.content}`).join('\n')}`;

    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractPrompt }],
      max_tokens: 200,
      temperature: 0
    });

    const raw = extraction.choices[0].message.content.trim();
    
    if (raw === 'null' || !raw.startsWith('{')) return null;

    const details = JSON.parse(raw);
    
    if (!details.guestName || !details.checkIn || !details.checkOut || !details.roomType || !details.numberOfGuests) {
      return null;
    }

    // Calculate total amount
    const roomPrices = { 'Standard Room': 2500, 'Deluxe Room': 4000, 'Suite': 7500 };
    const pricePerNight = roomPrices[details.roomType] || 2500;
    const nights = Math.ceil((new Date(details.checkOut) - new Date(details.checkIn)) / (1000 * 60 * 60 * 24));
    const totalAmount = pricePerNight * nights * (details.numberOfRooms || 1);

    // Check if booking already exists for this conversation
    const existing = await Booking.findOne({ phone, status: 'pending' }).sort({ createdAt: -1 });
    
    if (existing) {
      // Update existing pending booking
      existing.guestName = details.guestName;
      existing.checkIn = new Date(details.checkIn);
      existing.checkOut = new Date(details.checkOut);
      existing.roomType = details.roomType;
      existing.numberOfGuests = details.numberOfGuests;
      existing.totalAmount = totalAmount;
      await existing.save();
      return existing;
    } else {
      // Create new booking
      const booking = await Booking.create({
        hotelId,
        customerId,
        guestName: details.guestName,
        phone,
        checkIn: new Date(details.checkIn),
        checkOut: new Date(details.checkOut),
        roomType: details.roomType,
        numberOfGuests: details.numberOfGuests,
        totalAmount,
        status: 'pending',
        source: 'whatsapp'
      });
      return booking;
    }
  } catch (err) {
    // Silent fail — booking extraction is best-effort
    console.log('ℹ️ Booking extraction skipped:', err.message);
    return null;
  }
}

// ============================================================
// VERIFY WEBHOOK
// ============================================================
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ============================================================
// MAIN WEBHOOK — Clean, smart, no conflicts
// ============================================================
router.post('/', async (req, res) => {
  // Always respond immediately to Meta
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

    // Extract message content
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

    console.log(`📩 [${customerPhone}] "${userMessage}" | id: "${interactiveId}"`);

    // ── Find Hotel ──
    const hotel = await Hotel.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!hotel) {
      console.log('❌ No hotel found for phoneNumberId:', phoneNumberId);
      return;
    }

    // ── Find or Create Customer ──
    const customer = await Customer.findOneAndUpdate(
      { phone: customerPhone, hotelId: hotel._id },
      { lastSeen: new Date() },
      { upsert: true, new: true }
    );

    // ══════════════════════════════════════════
    // HANDLER 1: PAYMENT CONFIRMATION
    // ══════════════════════════════════════════
    if (/^(paid|payment done|payment complete|done|completed|pay kar diya|pay ho gaya)/i.test(userMessage)) {
      const booking = await Booking.findOne({ phone: customerPhone, status: 'pending' }).sort({ createdAt: -1 });

      if (booking) {
        booking.status = 'confirmed';
        await booking.save();

        // Update chat status
        await Chat.findOneAndUpdate(
          { phone: customerPhone, hotelId: hotel._id },
          { status: 'booked' }
        );

        const nights = Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
        const confirmMsg = `🎉 *Booking Confirmed!*

✅ *Name:* ${booking.guestName}
🛏️ *Room:* ${booking.roomType}
📅 *Check-in:* ${new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
📅 *Check-out:* ${new Date(booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
🌙 *Nights:* ${nights}
👥 *Guests:* ${booking.numberOfGuests}
💰 *Total Paid:* ₹${booking.totalAmount?.toLocaleString()}

Thank you for choosing *Innhance Hotels!* 🏨
We look forward to hosting you. See you soon! 😊

_Booking ID: #${booking._id.toString().slice(-6).toUpperCase()}_`;

        await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
        await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', confirmMsg);
        await sendText(customerPhone, confirmMsg, phoneNumberId);
        return;
      } else {
        // No pending booking found
        const reply = await getSmartReply(
          customerPhone, hotel._id, customer._id, userMessage,
          'Customer said they paid but no pending booking was found. Politely ask them to clarify or start a new booking.'
        );
        await sendText(customerPhone, reply, phoneNumberId);
        return;
      }
    }

    // ══════════════════════════════════════════
    // HANDLER 2: FIRST MESSAGE / GREETING → Show menu
    // ══════════════════════════════════════════
    const firstTime = await isFirstMessage(customerPhone, hotel._id);
    const isGreeting = /^(hi|hii|hiii|hello|hey|helo|hola|good morning|good evening|good afternoon|namaste|namaskar|start|menu)\b/i.test(userMessage);
    const isMenuRequest = /^(menu|main menu|start|help|options|back to menu)\b/i.test(userMessage);

    if (firstTime || isMenuRequest) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendMainMenu(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Main Menu]');
      return;
    }

    // ══════════════════════════════════════════
    // HANDLER 3: INTERACTIVE MENU SELECTIONS
    // ══════════════════════════════════════════

    // -- View Rooms --
    if (interactiveId === 'menu_rooms') {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', 'I want to see the rooms');
      await sendRoomPhotos(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Room photos]');
      return;
    }

    // -- Book a Room (from menu or photos) --
    if (interactiveId === 'menu_book' || interactiveId === 'photo_book') {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', 'I want to book a room');
      await sendRoomMenu(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Room selection menu]');
      return;
    }

    // -- Special Offers --
    if (interactiveId === 'menu_offers') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'What special offers and deals do you have?',
        'Customer clicked on Special Offers from the menu. Tell them about all current deals warmly.'
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // -- Check-in Timings --
    if (interactiveId === 'menu_checkin') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'What are the check-in and check-out timings and cancellation policy?',
        'Customer clicked on Timings & Policies from the menu. Give them all timing info clearly.'
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // -- Contact --
    if (interactiveId === 'menu_contact') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'How can I contact the hotel directly?',
        'Customer wants contact information. Share phone number and email warmly.'
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // -- Room Selected from menu --
    if (['room_standard', 'room_deluxe', 'room_suite'].includes(interactiveId)) {
      const roomLabels = {
        room_standard: 'Standard Room (₹2,500/night)',
        room_deluxe: 'Deluxe Room (₹4,000/night)',
        room_suite: 'Suite (₹7,500/night)'
      };
      const roomChoice = roomLabels[interactiveId];
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        `I'd like to book the ${roomChoice}`,
        `Customer selected ${roomChoice} from the room menu. Start the booking flow — ask for their full name next. Do NOT ask about room type again.`
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // -- Ask a Question (from photos) --
    if (interactiveId === 'photo_ask') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'I have a question about the hotel',
        'Customer wants to ask a question. Ask them what they would like to know.'
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // ══════════════════════════════════════════
    // HANDLER 4: TEXT SHORTCUTS
    // ══════════════════════════════════════════

    // Show rooms via text
    if (/\b(show.*rooms?|rooms?.*photo|see.*rooms?|view.*rooms?|photos?|pictures?|images?)\b/i.test(userMessage)) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendRoomPhotos(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Room photos]');
      return;
    }

    // Payment request via text
    if (/\b(pay|payment|qr|upi|gpay|phonepe|paytm|how.*pay|online.*pay)\b/i.test(userMessage)) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendPaymentQR(customerPhone, phoneNumberId);
      await sendText(customerPhone, '📲 Scan the QR above to pay!\n\nOnce done, just reply *paid* and your booking is confirmed! ✅', phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Payment QR]');
      return;
    }

    // ══════════════════════════════════════════
    // HANDLER 5: ALL OTHER MESSAGES → Smart AI
    // ══════════════════════════════════════════
    const reply = await getSmartReply(customerPhone, hotel._id, customer._id, userMessage);
    await sendText(customerPhone, reply, phoneNumberId);

    // ── Try to auto-save booking if all details collected ──
    // Run in background, doesn't block response
    getHistory(customerPhone, hotel._id).then(history => {
      tryExtractAndSaveBooking(customerPhone, hotel._id, customer._id, history);
    }).catch(() => {});

    // ── If booking looks complete, offer payment ──
    const lowerReply = reply.toLowerCase();
    const bookingComplete = 
      lowerReply.includes('booking summary') || 
      lowerReply.includes('total:') || 
      lowerReply.includes('confirm') && lowerReply.includes('₹');
      
    if (bookingComplete) {
      setTimeout(async () => {
        await sendPaymentQR(customerPhone, phoneNumberId);
        await sendText(
          customerPhone,
          '💳 *Scan the QR above to complete your payment!*\n\nOnce done, reply *paid* and your booking will be confirmed instantly! ✅',
          phoneNumberId
        );
      }, 2000);
    }

  } catch (err) {
    console.error('❌ Webhook error:', err.message, err.stack);
  }
});

module.exports = router;