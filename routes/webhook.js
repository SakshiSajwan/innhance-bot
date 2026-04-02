const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const OpenAI  = require('openai');
const QRCode  = require('qrcode');       // npm install qrcode
const FormData = require('form-data');   // npm install form-data

const Hotel    = require('../models/Hotel');
const Customer = require('../models/Customer');
const Chat     = require('../models/Chat');
const Booking  = require('../models/Booking');
const Payment  = require('../models/Payment');

const openai         = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ============================================================
// PAYMENT CONFIG — All payments go to Arnav's UPI
// ============================================================
const PLATFORM_UPI_ID   = process.env.PLATFORM_UPI_ID   || 'arnav@okicici';
const PLATFORM_UPI_NAME = process.env.PLATFORM_UPI_NAME || 'Arnav Prabhakar';
const IMGBB_API_KEY     = process.env.IMGBB_API_KEY;     // free at imgbb.com/api

const roomImages = {
  standard: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  deluxe:   'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
  suite:    'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800',
};

// ============================================================
// ROOM CAPACITY RULES
// ============================================================
const ROOM_CAPACITY = {
  'Standard Room': { maxAdults: 2, maxTotal: 3 },
  'Deluxe Room':   { maxAdults: 3, maxTotal: 4 },
  'Suite':         { maxAdults: 4, maxTotal: 6 },
};

// ============================================================
// MASTER SYSTEM PROMPT
// ============================================================
const SYSTEM_PROMPT = `You are Inna, the AI receptionist for Innhance Hotels. You are warm, smart, witty, and speak like a real human — not a robot. You handle everything: answering questions, booking rooms, taking payments, and helping guests.

VERY IMPORTANT — WHO YOU ARE:
- You are the HOTEL ASSISTANT, not the customer
- You NEVER write from the customer's perspective
- You NEVER say things like "I want to book a room" or "I am a guest"
- You always reply AS Inna TO the customer

═══════════════════════════════════
PAYMENT AND CANCELLATION RULES (STRICTLY FOLLOW THESE):
1. If the customer chooses "Pay at Desk": Confirm their booking and tell them "Okay, your booking is confirmed. You can pay at the hotel desk upon arrival."
2. If the customer chooses "Pay by QR" or "Online": Tell them you will provide the payment QR right away.
3. If the customer asks to "Cancel" their booking: DO NOT cancel it automatically. Politely apologize and tell them: "To cancel your booking, please contact the hotel directly at  93197 80058."
═══════════════════════════════════

═══════════════════════════════════
HOTEL INFORMATION
═══════════════════════════════════
Rooms & Pricing:
- Standard Room — ₹2,500/night | Cozy, perfect for solo or couple stays
- Deluxe Room — ₹4,000/night | Spacious with beautiful city views
- Suite — ₹7,500/night | Ultimate luxury, premium facilities
- All rooms include FREE breakfast + FREE WiFi

Room Capacity (VERY IMPORTANT — enforce this during booking):
- Standard Room: max 2 adults + 1 child (max 3 total)
- Deluxe Room: max 3 adults + 1 child (max 4 total)
- Suite: max 4 adults + 2 children (max 6 total)
- Children under 12 stay FREE and do not count toward adult capacity
- If a guest exceeds adult capacity for their chosen room, suggest upgrading to a larger room OR booking multiple rooms

Amenities:
- The hotel does NOT have a swimming pool
- Restaurant on-site, 24/7 room service
- Gym, Spa, Conference room available
- Free WiFi throughout the property
- Free parking

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

Payment Methods:
- Online: UPI/QR code
- At hotel: Pay at Desk (Cash, Credit/Debit cards)
- Always ask the customer if they prefer "Pay at Desk" or "Pay via QR" before finalizing.
- After paying online, customer must send a SCREENSHOT of the payment for verification.

═══════════════════════════════════
BOOKING FLOW
═══════════════════════════════════
When a customer wants to book, collect these ONE BY ONE naturally:
1. Full name
2. Check-in date (DD/MM/YYYY)
3. Check-out date (DD/MM/YYYY)
4. Number of rooms
5. Number of guests (ask how many are adults and how many are children separately if total seems high)
6. Room type (if not already chosen)

CAPACITY CHECK (do this before showing the summary):
- If the number of adults exceeds the room's adult limit, DO NOT just silently accept it
- Politely explain the capacity limit and suggest: upgrade to a bigger room OR book an additional room

Once all details are confirmed AND capacity is valid, ask their payment preference (At Desk or QR). 
Then show a beautiful booking summary and confirm everything.

═══════════════════════════════════
HOW TO HANDLE QUESTIONS
═══════════════════════════════════
- If someone asks a question (even mid-booking) — ANSWER IT FIRST, then continue
- If someone asks about a facility we don't have (like a pool) — politely say we don't have it, then mention what we DO have
- If someone asks about price — give exact price from the info above
- Never make up amenities or facilities not listed above

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
- Always move the conversation FORWARD — never get stuck

LANGUAGE RULES:
- Detect the language the customer is writing in and ALWAYS reply in the SAME language
- If customer writes in Hindi — reply in Hindi
- If customer writes in Hinglish — reply in Hinglish
- For all Indian languages you can use Roman script if customer is using that
- NEVER switch languages mid-conversation unless customer switches first`;

// ============================================================
// HELPER: Normalize phone number (strips country code)
// ============================================================
function normalizePhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  return p;
}

// ============================================================
// HELPER: Build UPI deep link
// ============================================================
function buildUpiLink(amount, transactionNote) {
  const pa = encodeURIComponent(PLATFORM_UPI_ID);
  const pn = encodeURIComponent(PLATFORM_UPI_NAME);
  const tn = encodeURIComponent(transactionNote);
  return `upi://pay?pa=${pa}&pn=${pn}&am=${amount.toFixed(2)}&cu=INR&tn=${tn}&mc=0000`;
}

function buildTransactionNote(hotelCode, bookingRef) {
  return `HOTEL-${hotelCode}-BOOK-${bookingRef}`;
}

// ============================================================
// WHATSAPP SEND FUNCTIONS
// ============================================================
async function sendText(to, message, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('❌ sendText error:', err.response?.data || err.message);
  }
}

async function sendImage(to, imageUrl, caption, phoneNumberId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to, type: 'image', image: { link: imageUrl, caption } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
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
        messaging_product: 'whatsapp', to, type: 'interactive',
        interactive: {
          type: 'button', body: { text: bodyText },
          action: { buttons: buttons.map(btn => ({ type: 'reply', reply: { id: btn.id, title: btn.title } })) },
        },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
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
        messaging_product: 'whatsapp', to, type: 'interactive',
        interactive: {
          type: 'list', body: { text: bodyText },
          action: { button: '👇 View Options', sections },
        },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('❌ sendList error:', err.response?.data || err.message);
  }
}

// ============================================================
// DYNAMIC UPI QR GENERATOR
// ============================================================
async function sendPaymentQR(to, phoneNumberId, booking, hotel) {
  try {
    const bookingRef      = booking._id.toString().slice(-6).toUpperCase();
    const hotelCode       = hotel.shortCode || hotel._id.toString().slice(-6).toUpperCase();
    const transactionNote = buildTransactionNote(hotelCode, bookingRef);
    const upiLink         = buildUpiLink(booking.totalAmount, transactionNote);

    // Generate QR as PNG buffer
    const qrBuffer = await QRCode.toBuffer(upiLink, { width: 400, margin: 2 });

    // Save/update Payment record as "pending"
    await Payment.findOneAndUpdate(
      { bookingId: booking._id },
      {
        hotelId:         hotel._id,
        hotelName:       hotel.name,
        bookingId:       booking._id,
        bookingRef,
        customerPhone:   booking.phone,
        guestName:       booking.guestName,
        amount:          booking.totalAmount,
        transactionNote,
        status:          'pending',
      },
      { upsert: true, new: true }
    );

    // Upload QR to imgbb so WhatsApp can fetch it as an image URL
    const form = new FormData();
    form.append('image', qrBuffer.toString('base64'));

    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      form,
      { headers: form.getHeaders() }
    );
    const qrUrl = imgbbRes.data.data.url;

    // Send QR image via WhatsApp
    await sendImage(
      to,
      qrUrl,
      `💳 *Pay ₹${booking.totalAmount.toLocaleString()} to complete your booking*\n\n` +
      `📱 Scan with GPay / PhonePe / Paytm / any UPI app\n\n` +
      `📸 After paying, please *send a screenshot* of the successful payment!`,
      phoneNumberId
    );

    console.log(`✅ QR sent for booking ${bookingRef} | note: ${transactionNote}`);
    return transactionNote;

  } catch (err) {
    console.error('❌ sendPaymentQR error:', err.message);

    // Fallback: send UPI details as plain text if QR generation/upload fails
    const bookingRef      = booking._id.toString().slice(-6).toUpperCase();
    const hotelCode       = hotel.shortCode || hotel._id.toString().slice(-6).toUpperCase();
    const transactionNote = buildTransactionNote(hotelCode, bookingRef);

    await sendText(
      to,
      `💳 *Pay ₹${booking.totalAmount.toLocaleString()} via UPI*\n\n` +
      `UPI ID: *${PLATFORM_UPI_ID}*\n` +
      `Name: *${PLATFORM_UPI_NAME}*\n` +
      `Amount: *₹${booking.totalAmount.toLocaleString()}*\n` +
      `Note: *${transactionNote}* ← paste this as the payment note!\n\n` +
      `📸 After paying, please *send a screenshot* of the successful payment!`,
      phoneNumberId
    );
    return transactionNote;
  }
}

// ============================================================
// FETCH WHATSAPP MEDIA AS BASE64
// ============================================================
async function fetchWhatsAppMediaAsBase64(mediaId) {
  try {
    const mediaRes = await axios.get(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
    const mediaUrl = mediaRes.data.url;

    const imageRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      responseType: 'arraybuffer',
    });

    const base64   = Buffer.from(imageRes.data, 'binary').toString('base64');
    const mimeType = imageRes.headers['content-type'] || 'image/jpeg';
    return { base64, mimeType };
  } catch (err) {
    console.error('❌ fetchWhatsAppMediaAsBase64 error:', err.message);
    return null;
  }
}

// ============================================================
// VERIFY PAYMENT SCREENSHOT USING GPT-4o VISION
// ============================================================
async function verifyPaymentScreenshot(base64Image, mimeType, expectedAmount) {
  try {
    const prompt = `You are a payment verification assistant. Carefully examine this UPI payment screenshot.

Extract and return ONLY a JSON object with these fields:
{
  "receiverName": "exact name shown as receiver/payee on the screenshot",
  "amountPaid": 1234,
  "transactionDate": "DD/MM/YYYY or null if not visible",
  "transactionId": "UPI transaction ID or null if not visible",
  "isSuccessful": true or false
}

Rules:
- receiverName: exact name of the payment receiver shown on the screenshot
- amountPaid: numeric amount only (no ₹ symbol, just the number)
- isSuccessful: true ONLY if the screenshot clearly shows payment SUCCESS/COMPLETED
- Return ONLY valid JSON, no extra text`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' } },
        ],
      }],
      max_tokens: 300,
      temperature: 0,
    });

    const raw  = response.choices[0].message.content.trim().replace(/```json|```/g, '');
    const data = JSON.parse(raw);

    const nameMatch   = data.receiverName?.toLowerCase().includes(PLATFORM_UPI_NAME.toLowerCase());
    const amountMatch = Math.abs(data.amountPaid - expectedAmount) <= 1;
    const isSuccess   = data.isSuccessful === true;

    return {
      verified:      nameMatch && amountMatch && isSuccess,
      nameMatch,
      amountMatch,
      isSuccess,
      extracted:     data,
      expectedAmount,
    };
  } catch (err) {
    console.error('❌ verifyPaymentScreenshot error:', err.message);
    return { verified: false, error: err.message };
  }
}

// ============================================================
// MENU FUNCTIONS
// ============================================================
async function sendMainMenu(to, phoneNumberId) {
  await sendList(
    to,
    "👋 *Welcome to Innhance Hotels!*\n\nI'm Inna, your personal hotel assistant. How can I help you today? 😊",
    [{
      title: 'What can we help with?',
      rows: [
        { id: 'menu_book',    title: '🛏️ Book a Room',     description: 'Reserve your perfect stay'   },
        { id: 'menu_rooms',   title: '🏨 Rooms & Photos',   description: 'See all rooms with prices'   },
        { id: 'menu_offers',  title: '🎁 Special Offers',   description: 'Deals & discounts available' },
        { id: 'menu_checkin', title: '⏰ Timings & Policy', description: 'Check-in, check-out & more'  },
        { id: 'menu_contact', title: '📞 Contact Us',       description: 'Reach our team directly'     },
      ],
    }],
    phoneNumberId
  );
}

async function sendRoomMenu(to, phoneNumberId) {
  await sendList(
    to,
    '🏨 *Choose your room type:*\n\n• 🛏️ Standard — ₹2,500/night (max 2 adults)\n• ✨ Deluxe — ₹4,000/night (max 3 adults)\n• 👑 Suite — ₹7,500/night (max 4 adults)\n\n✅ All rooms include FREE breakfast & WiFi!\n👶 Children under 12 stay FREE!',
    [{
      title: 'Available Rooms',
      rows: [
        { id: 'room_standard', title: '🛏️ Standard Room', description: '₹2,500/night — max 2 adults' },
        { id: 'room_deluxe',   title: '✨ Deluxe Room',   description: '₹4,000/night — max 3 adults' },
        { id: 'room_suite',    title: '👑 Suite',         description: '₹7,500/night — max 4 adults' },
      ],
    }],
    phoneNumberId
  );
}

async function sendRoomPhotos(to, phoneNumberId) {
  await sendText(to, "📸 *Here's a look at our beautiful rooms!* 😍", phoneNumberId);
  await sendImage(to, roomImages.standard, '🛏️ *Standard Room* — ₹2,500/night\nMax 2 adults | Free breakfast & WiFi ✅', phoneNumberId);
  await sendImage(to, roomImages.deluxe,   '✨ *Deluxe Room* — ₹4,000/night\nMax 3 adults | Free breakfast & WiFi ✅', phoneNumberId);
  await sendImage(to, roomImages.suite,    '👑 *Suite* — ₹7,500/night\nMax 4 adults | Free breakfast & WiFi ✅', phoneNumberId);
  await sendButtons(
    to,
    'Which room would you like to book? 😊',
    [
      { id: 'photo_book', title: '🛏️ Book a Room'   },
      { id: 'photo_ask',  title: '❓ Ask a Question' },
    ],
    phoneNumberId
  );
}

// ============================================================
// DATABASE FUNCTIONS
// ============================================================
async function saveMessage(phone, hotelId, customerId, role, content) {
  try {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    await Chat.updateOne(
      { phone, hotelId },
      {
        $setOnInsert: {
          phone, hotelId,
          name:   'Guest ' + phone.slice(-4),
          avatar: 'G',
        },
        $set: {
          customerId,
          lastMessage: content.substring(0, 120),
          time: 'Just now',
        },
        $push: { messages: { role, content, time } },
        ...(role === 'user' ? { $inc: { unread: 1 } } : {}),
      },
      { upsert: true }
    );
    return Chat.findOne({ phone, hotelId });
  } catch (err) {
    console.error('❌ saveMessage error:', err.message);
  }
}

async function getHistory(phone, hotelId) {
  try {
    const chat = await Chat.findOne({ phone, hotelId });
    if (!chat?.messages?.length) return [];
    return chat.messages
      .filter(m =>
        typeof m.content === 'string' &&
        !m.content.startsWith('[') &&
        m.content.trim().length > 0
      )
      .slice(-40)
      .map(m => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
  } catch (err) {
    console.error('❌ getHistory error:', err.message);
    return [];
  }
}

async function isFirstMessage(phone, hotelId) {
  try {
    const chat = await Chat.findOne({ phone, hotelId });
    return !chat?.messages?.length;
  } catch { return true; }
}

function detectPreferredLanguage(text = '') {
  const input = String(text).trim();
  const lower = input.toLowerCase();
  if (!input) return 'English';
  if (/\b(english|speak english|reply in english)\b/i.test(lower)) return 'English';
  if (/\b(hindi|hindi me|reply in hindi)\b/i.test(lower) || /[\u0900-\u097F]/.test(input)) return 'Hindi';
  const hinglishMarkers = ['mujhe','mera','meri','kya','hai','hain','karna','chahiye','kal','parso','aap','hum','log','ek','teen','raat'];
  if (hinglishMarkers.filter(w => lower.includes(w)).length >= 2) return 'Hindi';
  return 'English';
}

function looksLikeQuestion(text = '') {
  const input = String(text).trim().toLowerCase();
  if (!input) return false;
  return (
    input.includes('?') ||
    /^(is|are|do|does|can|could|would|will|what|when|where|why|how|which|who)\b/.test(input)
  );
}

// ============================================================
// CAPACITY VALIDATION
// ============================================================
function validateCapacity(roomType, numberOfGuests, numberOfRooms, adultsCount, childrenCount) {
  const capacity = ROOM_CAPACITY[roomType];
  if (!capacity) return { valid: true };

  const rooms    = numberOfRooms || 1;
  const adults   = adultsCount   || numberOfGuests;
  const totalCap = capacity.maxTotal  * rooms;
  const adultCap = capacity.maxAdults * rooms;

  if (adults > adultCap) {
    return {
      valid: false,
      reason: 'adults',
      message:
        `Our ${roomType} fits up to ${capacity.maxAdults} adult${capacity.maxAdults > 1 ? 's' : ''} per room. ` +
        `For ${adults} adults you'd need either ${Math.ceil(adults / capacity.maxAdults)} rooms or our ` +
        `${adults <= ROOM_CAPACITY['Suite'].maxAdults ? 'Suite' : 'Suite + extra room'}. ` +
        `Which works better for you? 😊`,
    };
  }

  if ((adultsCount + childrenCount) > totalCap) {
    return {
      valid: false,
      reason: 'total',
      message:
        `Our ${roomType} can accommodate up to ${capacity.maxTotal} guests (adults + children) per room. ` +
        `Would you like to upgrade to a larger room or add another room? 😊`,
    };
  }

  return { valid: true };
}

// ============================================================
// CORE AI FUNCTION
// ============================================================
async function getSmartReply(phone, hotelId, customerId, userMessage, contextHint = null, responseLanguage = null) {
  try {
    await saveMessage(phone, hotelId, customerId, 'user', userMessage);
    const history = await getHistory(phone, hotelId);

    const chosenLanguage = responseLanguage || detectPreferredLanguage(userMessage);

    const systemMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content:
          'IDENTITY REMINDER: You are Inna, the hotel receptionist. ' +
          'Every message you write is FROM you (Inna) TO the customer. ' +
          'Never produce a reply that reads like the customer is speaking. ' +
          'Never start with "I want to...", "I would like to...", or any first-person guest phrasing.',
      },
      {
        role: 'system',
        content:
          `Reply in ${chosenLanguage}. Stay in this language. ` +
          'Only switch if the customer explicitly writes in a different language.',
      },
      ...(looksLikeQuestion(userMessage)
        ? [{
            role: 'system',
            content:
              'The customer just asked a direct question. Answer it completely FIRST. ' +
              'If they asked about something we do not have, honestly say so and mention a relevant alternative. ' +
              'Only return to booking questions AFTER answering.',
          }]
        : []),
      ...(contextHint ? [{ role: 'system', content: `[CONTEXT NOTE: ${contextHint}]` }] : []),
    ];

    const completion = await openai.chat.completions.create({
      model:             'gpt-4o',
      messages:          [...systemMessages, ...history],
      max_tokens:        600,
      temperature:       0.75,
      presence_penalty:  0.3,
      frequency_penalty: 0.3,
    });

    const reply = completion.choices[0].message.content.trim();
    await saveMessage(phone, hotelId, customerId, 'assistant', reply);
    return reply;
  } catch (err) {
    console.error('❌ getSmartReply error:', err.message);
    return "Oops, I ran into a little issue! 😅 Give me a moment and try again please.";
  }
}

// ============================================================
// EXTRACT & SAVE BOOKING FROM CONVERSATION
// ============================================================
async function tryExtractAndSaveBooking(phone, hotelId, customerId, history) {
  try {
    const extractPrompt = `Look at this conversation and extract booking details if all are present.
Return ONLY a JSON object with these exact keys, or return null if any detail is missing:
{
  "guestName": "full name",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "roomType": "Standard Room / Deluxe Room / Suite",
  "numberOfGuests": 2,
  "numberOfRooms": 1,
  "adultsCount": 2,
  "childrenCount": 0
}
- adultsCount: guests aged 13+
- childrenCount: guests under 12
- If not split, set adultsCount = numberOfGuests and childrenCount = 0
Return null if guestName, checkIn, checkOut, or roomType is missing.
Return ONLY the JSON, no explanation.

Conversation:
${history.map(m => `${m.role}: ${m.content}`).join('\n')}`;

    const extraction = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      messages:    [{ role: 'user', content: extractPrompt }],
      max_tokens:  250,
      temperature: 0,
    });

    const raw = extraction.choices[0].message.content.trim().replace(/```json|```/g, '');
    if (raw === 'null' || !raw.startsWith('{')) return null;

    const details = JSON.parse(raw);
    if (!details.guestName || !details.checkIn || !details.checkOut || !details.roomType) return null;

    // Capacity check before saving
    const capacityCheck = validateCapacity(
      details.roomType,
      details.numberOfGuests,
      details.numberOfRooms,
      details.adultsCount || details.numberOfGuests,
      details.childrenCount || 0
    );
    if (!capacityCheck.valid) {
      console.log('⚠️ Capacity exceeded — booking not saved yet');
      return null;
    }

    const roomPrices    = { 'Standard Room': 2500, 'Deluxe Room': 4000, 'Suite': 7500 };
    const pricePerNight = roomPrices[details.roomType] || 2500;
    const nights        = Math.ceil((new Date(details.checkOut) - new Date(details.checkIn)) / (1000 * 60 * 60 * 24));
    const totalAmount   = pricePerNight * nights * (details.numberOfRooms || 1);

    const existing = await Booking.findOne({ phone, hotelId, status: 'pending' }).sort({ createdAt: -1 });

    if (existing) {
      Object.assign(existing, {
        guestName:      details.guestName,
        checkIn:        new Date(details.checkIn),
        checkOut:       new Date(details.checkOut),
        roomType:       details.roomType,
        numberOfGuests: details.numberOfGuests,
        totalAmount,
      });
      await existing.save();
      return existing;
    } else {
      return await Booking.create({
        hotelId, customerId,
        guestName:      details.guestName,
        phone,
        checkIn:        new Date(details.checkIn),
        checkOut:       new Date(details.checkOut),
        roomType:       details.roomType,
        numberOfGuests: details.numberOfGuests,
        totalAmount,
        status:  'pending',
        source:  'whatsapp',
      });
    }
  } catch (err) {
    console.log('ℹ️ Booking extraction skipped:', err.message);
    return null;
  }
}

// ============================================================
// VERIFY WEBHOOK (GET)
// ============================================================
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ============================================================
// MAIN WEBHOOK (POST)
// ============================================================
router.post('/', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry   = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    if (value?.statuses || !value?.messages) return;

    const message       = value.messages[0];
    const phoneNumberId = value.metadata?.phone_number_id;
    const customerPhone = message.from;

    if (customerPhone === phoneNumberId) return;

    // Skip stale messages older than 30 seconds
    const msgTime = parseInt(message.timestamp) * 1000;
    if (Date.now() - msgTime > 30000) {
      console.log('⏩ Skipping stale message from', customerPhone);
      return;
    }

    // ── Find Hotel ──────────────────────────────────────────
    const hotel = await Hotel.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!hotel) {
      console.log('❌ No hotel found for phoneNumberId:', phoneNumberId);
      return;
    }

    // ── Find or Create Customer ─────────────────────────────
    const customer = await Customer.findOneAndUpdate(
      { phone: customerPhone, hotelId: hotel._id },
      { lastSeen: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    const normalizedPhone = normalizePhone(customerPhone);

    // ══════════════════════════════════════════════════════════
    // HANDLER: IMAGE — Payment Screenshot Verification
    // ══════════════════════════════════════════════════════════
    if (message.type === 'image') {
      const mediaId = message.image?.id;
      if (!mediaId) {
        await sendText(customerPhone, "I couldn't read that image. Please try sending the screenshot again! 📸", phoneNumberId);
        return;
      }

      const booking = await Booking.findOne({
        phone:   { $in: [normalizedPhone, customerPhone] },
        hotelId: hotel._id,
        status:  { $in: ['pending', 'confirmed'] },
      }).sort({ createdAt: -1 });

      if (!booking) {
        await sendText(customerPhone, "I don't see a pending booking to verify payment for. Would you like to make a booking? 😊", phoneNumberId);
        return;
      }

      await sendText(customerPhone, '🔍 Verifying your payment screenshot, please wait a moment...', phoneNumberId);

      const media = await fetchWhatsAppMediaAsBase64(mediaId);
      if (!media) {
        await sendText(customerPhone, "Sorry, I couldn't download your screenshot. Please try sending it again! 📸", phoneNumberId);
        return;
      }

      const result = await verifyPaymentScreenshot(media.base64, media.mimeType, booking.totalAmount);
      console.log('💳 Payment verification result:', JSON.stringify(result));

      // Update Payment record with OCR results
      await Payment.findOneAndUpdate(
        { bookingId: booking._id },
        {
          transactionId:      result.extracted?.transactionId  || null,
          paidAt:             result.extracted?.transactionDate || null,
          screenshotVerified: result.verified,
          status:             result.verified ? 'verified' : 'failed',
        }
      );

      if (result.verified) {
        // ✅ Payment verified — confirm booking
        booking.status = 'confirmed';
        await booking.save();

        await Chat.findOneAndUpdate(
          { phone: customerPhone, hotelId: hotel._id },
          { status: 'booked' }
        );

        const nights = Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
        const payment = await Payment.findOne({ bookingId: booking._id });

        const confirmMsg =
`🎉 *Payment Verified & Booking Confirmed!*

✅ *Name:* ${booking.guestName}
🛏️ *Room:* ${booking.roomType}
📅 *Check-in:* ${new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
📅 *Check-out:* ${new Date(booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
🌙 *Nights:* ${nights}
👥 *Guests:* ${booking.numberOfGuests}
💰 *Amount Paid:* ₹${booking.totalAmount?.toLocaleString()}

Thank you for choosing *${hotel.name}!* 🏨
We look forward to hosting you. See you soon! 😊

_Booking ID: #${booking._id.toString().slice(-6).toUpperCase()}_
_Ref: ${payment?.transactionNote || ''}_`;

        await saveMessage(customerPhone, hotel._id, customer._id, 'user',      '[Sent: Payment screenshot]');
        await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', confirmMsg);
        await sendText(customerPhone, confirmMsg, phoneNumberId);

      } else {
        // ❌ Payment not verified
        let failReason = '';
        if (!result.isSuccess) {
          failReason = "The screenshot doesn't show a successful payment. Please make sure the payment went through and send the success confirmation screenshot. 🙏";
        } else if (!result.nameMatch) {
          failReason = `The payment receiver name doesn't match. Please pay to *${PLATFORM_UPI_NAME}* and send the screenshot again. 🙏`;
        } else if (!result.amountMatch) {
          failReason = `The amount on the screenshot (₹${result.extracted?.amountPaid}) doesn't match the booking total of ₹${result.expectedAmount}. Please check and send the correct payment screenshot. 🙏`;
        } else {
          failReason = "I couldn't verify the payment from this screenshot. Please send a clearer screenshot of the successful payment. 🙏";
        }

        await saveMessage(customerPhone, hotel._id, customer._id, 'user',      '[Sent: Payment screenshot]');
        await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', `❌ ${failReason}`);
        await sendText(customerPhone, `❌ ${failReason}`, phoneNumberId);
      }
      return;
    }

    // ── Only process text and interactive from here ─────────
    if (!['text', 'interactive'].includes(message.type)) {
      await sendText(customerPhone, "Sorry, I can only process text messages and images right now! 😊", phoneNumberId);
      return;
    }

    let userMessage   = '';
    let interactiveId = '';

    if (message.type === 'text') {
      userMessage = message.text.body.trim();
    } else if (message.type === 'interactive') {
      if (message.interactive.type === 'button_reply') {
        interactiveId = message.interactive.button_reply.id;
        userMessage   = message.interactive.button_reply.title;
      } else if (message.interactive.type === 'list_reply') {
        interactiveId = message.interactive.list_reply.id;
        userMessage   = message.interactive.list_reply.title;
      }
    }

    if (!userMessage) return;

    console.log(`📩 [${customerPhone}] "${userMessage}" | id: "${interactiveId}"`);

    // ══════════════════════════════════════════════════════════
    // HANDLER 1: "paid" text — redirect to screenshot
    // ══════════════════════════════════════════════════════════
    if (/^(paid|payment done|payment complete|pay kar diya|pay ho gaya)/i.test(userMessage)) {
      const booking = await Booking.findOne({ phone: normalizedPhone, hotelId: hotel._id, status: 'pending' }).sort({ createdAt: -1 });
      if (booking) {
        await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
        const msg =
          `📸 Please send a *screenshot* of your successful payment so I can verify and confirm your booking!\n\n` +
          `Make sure the screenshot shows:\n` +
          `✅ Payment successful status\n` +
          `✅ Receiver name: *${PLATFORM_UPI_NAME}*\n` +
          `✅ Amount: ₹${booking.totalAmount?.toLocaleString()}`;
        await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', msg);
        await sendText(customerPhone, msg, phoneNumberId);
      } else {
        const reply = await getSmartReply(
          customerPhone, hotel._id, customer._id, userMessage,
          'Customer said they paid but no pending booking found. Ask them to clarify or start a new booking.',
          detectPreferredLanguage(userMessage)
        );
        await sendText(customerPhone, reply, phoneNumberId);
      }
      return;
    }

    // ══════════════════════════════════════════════════════════
    // HANDLER 1.5: Pay at desk — confirm booking without QR
    // ══════════════════════════════════════════════════════════
    if (/\b(pay at desk|pay at hotel|pay on arrival|cash at hotel|desk pay|paying at desk|will pay at desk|pay when i arrive|pay there|at desk|at the desk)\b/i.test(userMessage)) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);

      const booking = await Booking.findOne({
        phone:   { $in: [normalizedPhone, customerPhone] },
        hotelId: hotel._id,
        status:  { $in: ['pending', 'confirmed'] },
      }).sort({ createdAt: -1 });

      if (booking) {
        booking.status = 'confirmed';
        await booking.save();

        await Chat.findOneAndUpdate(
          { phone: customerPhone, hotelId: hotel._id },
          { status: 'booked' }
        );

        const nights = Math.ceil(
          (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
        );

        const confirmMsg =
    `✅ *Booking Confirmed — Pay at Desk!*

    👤 *Name:* ${booking.guestName}
    🛏️ *Room:* ${booking.roomType}
    📅 *Check-in:* ${new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
    📅 *Check-out:* ${new Date(booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
    🌙 *Nights:* ${nights}
    👥 *Guests:* ${booking.numberOfGuests}
    💰 *Amount Due:* ₹${booking.totalAmount?.toLocaleString()} _(payable at hotel)_

    Thank you for choosing *${hotel.name}!* 🏨
    Please carry a valid ID at check-in. See you soon! 😊

    _Booking ID: #${booking._id.toString().slice(-6).toUpperCase()}_`;

        await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', confirmMsg);
        await sendText(customerPhone, confirmMsg, phoneNumberId);
      } else {
        const reply = await getSmartReply(
          customerPhone, hotel._id, customer._id, userMessage,
          'Customer wants to pay at desk. No pending booking found. Ask them to complete booking first.',
          detectPreferredLanguage(userMessage)
        );
        await sendText(customerPhone, reply, phoneNumberId);
      }
      return;
    }

    // ══════════════════════════════════════════════════════════
    // HANDLER 2: First message / Greeting → Show menu
    // ══════════════════════════════════════════════════════════
    const firstTime     = await isFirstMessage(customerPhone, hotel._id);
    const isGreeting    = /^(hi|hii|hiii|hello|hey|helo|hola|good morning|good evening|good afternoon|namaste|namaskar|start|menu)\b/i.test(userMessage);
    const isMenuRequest = /^(menu|main menu|start|help|options|back to menu)\b/i.test(userMessage);

    if ((firstTime && isGreeting) || isMenuRequest) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendMainMenu(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Main Menu]');
      return;
    }

    // ══════════════════════════════════════════════════════════
    // HANDLER 3: Interactive menu selections
    // ══════════════════════════════════════════════════════════
    if (interactiveId === 'menu_rooms') {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', 'I want to see the rooms');
      await sendRoomPhotos(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Room photos]');
      return;
    }

    if (interactiveId === 'menu_book' || interactiveId === 'photo_book') {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', 'I want to book a room');
      await sendRoomMenu(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Room selection menu]');
      return;
    }

    if (interactiveId === 'menu_offers') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'What special offers and deals do you have?',
        'Customer clicked Special Offers. Tell them about all current deals warmly.',
        detectPreferredLanguage(userMessage)
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (interactiveId === 'menu_checkin') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'What are the check-in and check-out timings and cancellation policy?',
        'Customer clicked Timings & Policies. Give all timing info clearly.',
        detectPreferredLanguage(userMessage)
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (interactiveId === 'menu_contact') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'How can I contact the hotel directly?',
        'Customer wants contact info. Share phone number and email warmly.',
        detectPreferredLanguage(userMessage)
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (['room_standard', 'room_deluxe', 'room_suite'].includes(interactiveId)) {
      const roomLabels = {
        room_standard: 'Standard Room (₹2,500/night)',
        room_deluxe:   'Deluxe Room (₹4,000/night)',
        room_suite:    'Suite (₹7,500/night)',
      };
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        `I'd like to book the ${roomLabels[interactiveId]}`,
        `Customer selected ${roomLabels[interactiveId]}. Start booking flow — ask for full name next. Do NOT ask room type again.`
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    if (interactiveId === 'photo_ask') {
      const reply = await getSmartReply(
        customerPhone, hotel._id, customer._id,
        'I have a question about the hotel',
        'Customer clicked Ask a Question. Warmly invite them to ask anything.',
        detectPreferredLanguage(userMessage)
      );
      await sendText(customerPhone, reply, phoneNumberId);
      return;
    }

    // ══════════════════════════════════════════════════════════
    // HANDLER 4: Text shortcuts
    // ══════════════════════════════════════════════════════════
    if (/\b(show.*rooms?|rooms?.*photo|see.*rooms?|view.*rooms?|photos?|pictures?|images?)\b/i.test(userMessage)) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);
      await sendRoomPhotos(customerPhone, phoneNumberId);
      await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Room photos]');
      return;
    }

    // ══════════════════════════════════════════════════════════
    // HANDLER 5: Payment / QR request
    // ══════════════════════════════════════════════════════════
    if (/\b(pay|payment|qr|upi|gpay|phonepe|paytm|how.*pay|online.*pay|where.*qr|send.*qr|qr.*send|qr.*bhejo|payment.*karo|pay.*karna)\b/i.test(userMessage)) {
      await saveMessage(customerPhone, hotel._id, customer._id, 'user', userMessage);

      // Step 1: Look for existing pending booking in DB
      let booking = await Booking.findOne({
        phone:   { $in: [normalizedPhone, customerPhone] },
        hotelId: hotel._id,
        status:  { $in: ['pending', 'confirmed'] },
      }).sort({ createdAt: -1 });

      // Step 2: If not found, try extracting from conversation history
      if (!booking) {
        const history = await getHistory(customerPhone, hotel._id);
        booking = await tryExtractAndSaveBooking(normalizedPhone, hotel._id, customer._id, history);
      }

      // Step 3: Send QR or ask to complete booking
      if (booking) {
        await sendPaymentQR(customerPhone, phoneNumberId, booking, hotel);
        await saveMessage(customerPhone, hotel._id, customer._id, 'assistant', '[Sent: Payment QR]');
      } else {
        await sendText(customerPhone, "Please complete your booking first and then I'll send you the payment QR! 😊", phoneNumberId);
      }
      return;
    }

    // ══════════════════════════════════════════════════════════
    // HANDLER 6: All other messages → Smart AI
    // ══════════════════════════════════════════════════════════
    const reply = await getSmartReply(customerPhone, hotel._id, customer._id, userMessage);
    await sendText(customerPhone, reply, phoneNumberId);

    // Try to extract and save booking from conversation in background
    const history = await getHistory(customerPhone, hotel._id);
    const booking = await tryExtractAndSaveBooking(normalizedPhone, hotel._id, customer._id, history);

    // If booking summary was shown → check if they want to pay at desk
    const lowerReply      = reply.toLowerCase();
    const isPayAtDesk     = lowerReply.includes('pay at desk') || lowerReply.includes('upon arrival') || lowerReply.includes('at the hotel desk');
    const bookingComplete =
      lowerReply.includes('booking summary') ||
      lowerReply.includes('total cost')      ||
      lowerReply.includes('total:')          ||
      lowerReply.includes('total amount')    ||
      (lowerReply.includes('confirm') && lowerReply.includes('₹'));

    // ✨ BUG FIX: Only send the QR code if they DID NOT choose "Pay at desk"
    if (bookingComplete && booking && !isPayAtDesk) {
      setTimeout(async () => {
        await sendPaymentQR(customerPhone, phoneNumberId, booking, hotel);
      }, 2000);
    }

  } catch (err) {
    console.error('❌ Webhook error:', err.message, err.stack);
  }
});

module.exports = router;