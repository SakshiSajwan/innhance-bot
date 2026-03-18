require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

// ===== HOTEL Q&A KNOWLEDGE BASE =====
const hotelReplies = [
  {
    keywords: ['room', 'available', 'availability', 'book', 'booking'],
    reply: 'We have the following rooms available:\n- Standard Room: ₹2,500/night\n- Deluxe Room: ₹4,000/night\n- Suite: ₹7,500/night\nWould you like to book one?'
  },
  {
    keywords: ['price', 'cost', 'rate', 'charge', 'fee', 'how much'],
    reply: 'Our room rates are:\n- Standard Room: ₹2,500/night\n- Deluxe Room: ₹4,000/night\n- Suite: ₹7,500/night\nBreakfast is included in all rooms! 🍳'
  },
  {
    keywords: ['check in', 'checkin', 'check-in', 'arrival'],
    reply: 'Check-in time is 2:00 PM. Early check-in is available on request (subject to availability). Please carry a valid photo ID at check-in.'
  },
  {
    keywords: ['check out', 'checkout', 'check-out', 'departure'],
    reply: 'Check-out time is 11:00 AM. Late check-out is available until 2:00 PM for an extra charge of ₹500.'
  },
  {
    keywords: ['pool', 'swimming', 'gym', 'spa', 'fitness'],
    reply: 'Our amenities include:\n🏊 Swimming Pool (6 AM - 10 PM)\n💪 Fully Equipped Gym (24/7)\n💆 Spa & Wellness Centre (9 AM - 8 PM)\nAll amenities are free for guests!'
  },
  {
    keywords: ['restaurant', 'food', 'breakfast', 'lunch', 'dinner', 'eat', 'meal'],
    reply: 'Our restaurant is open:\n🍳 Breakfast: 7 AM - 10 AM\n🍽️ Lunch: 12 PM - 3 PM\n🌙 Dinner: 7 PM - 11 PM\nBreakfast is complimentary for all guests!'
  },
  {
    keywords: ['wifi', 'internet', 'wi-fi'],
    reply: 'We offer free high-speed WiFi throughout the hotel. You will receive the password at check-in. 📶'
  },
  {
    keywords: ['cancel', 'cancellation', 'refund'],
    reply: 'Our cancellation policy:\n✅ Free cancellation up to 48 hours before check-in\n⚠️ 50% charge for cancellation within 48 hours\n❌ No refund for no-shows\nNeed to cancel your booking? Reply with your booking ID.'
  },
  {
    keywords: ['parking', 'car', 'vehicle'],
    reply: 'We offer free parking for all guests. Valet parking is also available for ₹200/day. 🚗'
  },
  {
    keywords: ['pet', 'dog', 'cat', 'animal'],
    reply: 'We are a pet-friendly hotel! Pets are welcome in designated rooms. Please inform us in advance. A refundable pet deposit of ₹500 is required. 🐾'
  },
  {
    keywords: ['location', 'address', 'where', 'directions', 'map'],
    reply: 'Innhance Hotels is located at:\n📍 123 Hotel Street, City Centre\nWe are 15 minutes from the airport and 5 minutes from the railway station. Need directions? We can arrange pickup! 🚖'
  },
  {
    keywords: ['contact', 'phone', 'call', 'email', 'reach'],
    reply: 'You can reach us at:\n📞 +91 98765 43210\n📧 info@innhance.com\n🕐 Front desk is available 24/7!'
  },
  {
    keywords: ['special', 'request', 'honeymoon', 'anniversary', 'birthday', 'celebrate'],
    reply: 'We love making special occasions memorable! 🎉 We offer:\n- Room decoration\n- Cake & flowers arrangement\n- Romantic dinner setup\nPlease let us know your requirements and we will make it special!'
  },
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings'],
    reply: 'Hello! Welcome to Innhance Hotels! 🏨\nHow can I assist you today? You can ask me about:\n- Room booking & availability\n- Prices & offers\n- Check-in / Check-out\n- Amenities & facilities\n- Cancellations'
  },
  {
    keywords: ['thank', 'thanks', 'thank you'],
    reply: 'You\'re welcome! 😊 It\'s our pleasure to assist you. Is there anything else I can help you with?'
  }
];

// ===== MATCH FUNCTION =====
function getBotReply(userMessage) {
  const msg = userMessage.toLowerCase();

  for (const item of hotelReplies) {
    for (const keyword of item.keywords) {
      if (msg.includes(keyword)) {
        return item.reply;
      }
    }
  }

  return "I'm sorry, I didn't quite understand that. 🙏 Could you please rephrase?\nYou can ask me about room booking, pricing, check-in/out, amenities, or cancellations.";
}

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.send('Innhance Bot is running! 🏨');
});

app.post('/webhook', (req, res) => {
  const userMessage = req.body.Body;
  const from = req.body.From;

  console.log(`Message from ${from}: ${userMessage}`);

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  const botReply = getBotReply(userMessage);
  console.log(`Bot reply: ${botReply}`);
  res.json({ reply: botReply });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
});