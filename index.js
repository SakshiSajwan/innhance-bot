const connectDB = require('./config/db');
connectDB(); // call it right after
require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== CONVERSATION MEMORY =====
const conversations = {};

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
- 15 minutes from airport
- 5 minutes from railway station
- Free pickup available

CONTACT:
- Phone: +91 98765 43210
- Email: info@innhance.com
- Front desk: 24/7

BOOKING FLOW:
When a guest wants to book a room, collect these details one by one in a conversational way:
1. Full name
2. Check-in date
3. Check-out date
4. Number of guests
5. Room type preference
Then summarize and confirm the booking.

IMPORTANT RULES:
- Always be warm, friendly and use emojis naturally
- Keep responses short and conversational
- If someone says hi/hello/hey, greet them warmly
- If asked something not related to the hotel, politely redirect
- Never make up information not provided above`;

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.send('Innhance Bot is running! 🏨');
});

app.post('/webhook', async (req, res) => {
  const userMessage = req.body.Body;
  const from = req.body.From;

  console.log(`Message from ${from}: ${userMessage}`);

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    // Initialize conversation history for new users
    if (!conversations[from]) {
      conversations[from] = [];
    }

    // Add user message to history
    conversations[from].push({
      role: 'user',
      content: userMessage
    });

    // Keep only last 10 messages to avoid token limit
    if (conversations[from].length > 10) {
      conversations[from] = conversations[from].slice(-10);
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversations[from]
      ],
      max_tokens: 300
    });

    const botReply = completion.choices[0].message.content;

    // Add bot reply to history
    conversations[from].push({
      role: 'assistant',
      content: botReply
    });

    console.log(`Bot reply: ${botReply}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${botReply}</Message>
</Response>`;
    res.set('Content-Type', 'text/xml');
    res.send(twiml);

  } catch (error) {
    console.error('Error:', error.message);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I'm having a little trouble right now! 😅 Please try again in a moment.</Message>
</Response>`;
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
});