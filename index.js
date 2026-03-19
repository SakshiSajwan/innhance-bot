require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// ===== SMART REPLY FUNCTION =====
function getBotReply(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  // GREETINGS
  if (/^(hi|hii|hiii|hello|hey|helo|hye|sup|howdy|good morning|good evening|good afternoon|good night|namaste|hola|greetings|yo|what'?s up)/.test(msg)) {
    const greetings = [
      "Hey there! 👋 Welcome to Innhance Hotels! So glad you reached out 😊 How can I make your day better? You can ask me about rooms, prices, amenities, or anything else!",
      "Hello! 🌟 Welcome to Innhance Hotels! We're super excited to have you here. What can I help you with today?",
      "Hi hi! 👋😄 You've reached Innhance Hotels! Whether you're planning a stay or just curious, I'm here to help! What's on your mind?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // HOW ARE YOU
  if (/(how are you|how r you|how are u|you okay|you good|hows it going|how's it going)/.test(msg)) {
    return "I'm doing amazing, thank you for asking! 😄✨ Ready to help you plan the perfect stay at Innhance Hotels! What can I do for you?";
  }

  // BOOKING INTENT
  if (/(i want to book|i want a room|book a room|i need a room|want to stay|i'd like to book|can i book|make a reservation|reserve a room|i want to reserve|book room|booking a room|need to book)/.test(msg)) {
    return "Yay! 🎉 We'd love to have you stay with us! Here are our room options:\n\n🛏️ *Standard Room* - ₹2,500/night\nPerfect for solo travelers or couples!\n\n🛏️✨ *Deluxe Room* - ₹4,000/night\nSpacious with a beautiful view!\n\n👑 *Suite* - ₹7,500/night\nThe ultimate luxury experience!\n\nAll rooms include FREE breakfast 🍳 and WiFi 📶\n\nWhich room catches your eye? 😊";
  }

  // SPECIFIC ROOM SELECTION
  if (/(standard room|deluxe room|suite|standard|deluxe)/.test(msg)) {
  const room = msg.includes('suite') ? 'Suite 👑 (₹7,500/night)' : msg.includes('deluxe') ? 'Deluxe Room ✨ (₹4,000/night)' : 'Standard Room 🛏️ (₹2,500/night)';
  return `Great choice! 🎉 You've selected the *${room}*!\n\nTo complete your booking, please share:\n\n📛 *Your Name*\n📅 *Check-in Date*\n📅 *Check-out Date*\n👥 *Number of Guests*\n\nOur team will confirm your booking within minutes! 😊`;
  }

  // ROOM AVAILABILITY
  if (/(room|available|availability|what rooms|which rooms|types of room|room types)/.test(msg)) {
    return "Great question! 🏨 Here's what we have available right now:\n\n🛏️ *Standard Room* - ₹2,500/night\n🛏️✨ *Deluxe Room* - ₹4,000/night\n👑 *Suite* - ₹7,500/night\n\nAll rooms come with:\n✅ Free breakfast\n✅ Free WiFi\n✅ 24/7 room service\n\nWant to book one? Just say the word! 😊";
  }

  // PRICE / COST
  if (/(price|cost|rate|charge|fee|how much|tariff|expensive|cheap|affordable|budget)/.test(msg)) {
    return "Here's our pricing breakdown 💰:\n\n🛏️ *Standard Room* - ₹2,500/night\n🛏️✨ *Deluxe Room* - ₹4,000/night\n👑 *Suite* - ₹7,500/night\n\nAnd the best part? *Breakfast is FREE* for all guests! 🍳🥐\n\nWe also offer special discounts for long stays! 🎁 Interested?";
  }

  // CHECK IN
  if (/(check.?in|check in|arrival|arriving|when can i check|what time check in)/.test(msg)) {
    return "Welcome soon! 🤗 Here's your check-in info:\n\n⏰ *Check-in time:* 2:00 PM\n🌅 *Early check-in* available on request (subject to availability)\n🪪 *Don't forget* to carry a valid photo ID!\n\nNeed help with anything else? 😊";
  }

  // CHECK OUT
  if (/(check.?out|checkout|departure|leaving|when do i check out|what time check out)/.test(msg)) {
    return "We'll miss you! 😢 Here's your check-out info:\n\n⏰ *Check-out time:* 11:00 AM\n🕑 *Late check-out* available until 2:00 PM for ₹500 extra\n\nNeed a cab or airport transfer? We can arrange that too! 🚖";
  }

  // AMENITIES / POOL / GYM / SPA
  if (/(pool|swimming|gym|spa|fitness|sauna|jacuzzi|amenities|facilities|what do you have|what's included)/.test(msg)) {
    return "Oh you're going to LOVE this! 🌟 Here's what we offer:\n\n🏊 *Swimming Pool* - Open 6 AM to 10 PM\n💪 *Fully Equipped Gym* - Open 24/7!\n💆 *Spa & Wellness Centre* - 9 AM to 8 PM\n🍽️ *In-house Restaurant* - All day dining\n🅿️ *Free Parking*\n📶 *High-speed WiFi* everywhere!\n\nAnd the best part - ALL of this is FREE for our guests! 🎉";
  }

  // RESTAURANT / FOOD
  if (/(restaurant|food|eat|breakfast|lunch|dinner|meal|hungry|menu|cuisine|dining)/.test(msg)) {
    return "Foodies rejoice! 🍽️😋 Our restaurant timings:\n\n🍳 *Breakfast:* 7 AM - 10 AM (FREE for guests!)\n🥗 *Lunch:* 12 PM - 3 PM\n🌙 *Dinner:* 7 PM - 11 PM\n\nWe serve Indian, Continental & Chinese cuisine! 🇮🇳🌍\nRoom service available 24/7 too! 🛎️";
  }

  // WIFI
  if (/(wifi|wi-fi|internet|network|connection|broadband)/.test(msg)) {
    return "Stay connected! 📶✨ We offer *super fast free WiFi* throughout the hotel - lobby, rooms, pool area, everywhere! 🙌\n\nYou'll get the password at check-in. No limits, no extra charges! 😊";
  }

  // CANCELLATION
  if (/(cancel|cancellation|refund|money back|cancel booking|cancel reservation)/.test(msg)) {
    return "No worries, we understand plans change! 😊 Here's our cancellation policy:\n\n✅ *Free cancellation* up to 48 hours before check-in\n⚠️ *50% charge* for cancellation within 48 hours\n❌ *No refund* for no-shows\n\nNeed to cancel? Just share your booking ID and we'll sort it out! 💪";
  }

  // PARKING
  if (/(parking|park|car|vehicle|bike|two wheeler|motorcycle)/.test(msg)) {
    return "Drive right in! 🚗 We've got you covered:\n\n🅿️ *Free parking* for all guests!\n🚘 *Valet parking* also available at ₹200/day\n🏍️ *Two-wheeler parking* - completely free!\n\nNo parking stress here! 😄";
  }

  // PETS
  if (/(pet|dog|cat|puppy|kitten|animal|fur baby|furry)/.test(msg)) {
    return "Aww we love furry friends! 🐾😍 Yes, we are *pet-friendly*!\n\n🐕 Pets welcome in designated rooms\n📞 Please inform us in advance\n💰 Refundable pet deposit of ₹500\n\nYour fur baby will feel right at home! 🏡";
  }

  // LOCATION
  if (/(location|address|where|directions|how to reach|map|navigate|find you|located)/.test(msg)) {
    return "We're right in the heart of the city! 📍\n\n🏨 *Innhance Hotels*\n123 Hotel Street, City Centre\n\n🛫 *15 minutes* from the airport\n🚆 *5 minutes* from the railway station\n🚖 Need a pickup? We'll arrange it for FREE!\n\nJust let us know your arrival time! 😊";
  }

  // CONTACT
  if (/(contact|phone|call|email|reach|talk to someone|speak to|customer care|support|help)/.test(msg)) {
    return "We're always here for you! 💙\n\n📞 *Phone:* +91 98765 43210\n📧 *Email:* info@innhance.com\n⏰ *Front desk:* Available 24/7!\n\nOr just keep chatting here - I'm always around! 😊";
  }

  // SPECIAL OCCASIONS
  if (/(special|honeymoon|anniversary|birthday|celebrate|proposal|surprise|romantic|wedding)/.test(msg)) {
    return "Ooh how exciting! 🎉💕 We LOVE making special moments unforgettable!\n\nHere's what we can arrange:\n🌹 *Room decoration* with flowers & balloons\n🎂 *Custom cake* delivery to your room\n🍷 *Romantic candle-light dinner*\n📸 *Photography* arrangements\n\nJust tell us the occasion and we'll make it magical! ✨";
  }

  // OFFERS / DISCOUNTS
  if (/(offer|discount|deal|coupon|promo|promotion|cheap|sale|package|combo)/.test(msg)) {
    return "Great news! 🎁 We have some amazing deals:\n\n🌟 *Weekend Special:* 15% off on Deluxe rooms!\n👨‍👩‍👧 *Family Package:* Kids under 12 stay FREE!\n📅 *Long Stay Deal:* 7 nights = 1 night FREE!\n💑 *Honeymoon Package:* Includes dinner + decoration!\n\nWant to grab any of these? 😊";
  }

  // THANK YOU
  if (/(thank|thanks|thank you|thankyou|thx|ty|appreciate)/.test(msg)) {
    const thanks = [
      "You're so welcome! 😊💙 It's our absolute pleasure to help! Is there anything else I can do for you?",
      "Aww thank YOU for choosing Innhance Hotels! 🙏✨ We can't wait to host you! Anything else?",
      "Happy to help anytime! 😄 That's what we're here for! Let me know if you need anything else! 🏨",
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }

  // BYE
  if (/(bye|goodbye|good bye|see you|see ya|take care|cya|ttyl|later)/.test(msg)) {
    return "Goodbye! 👋😊 It was lovely chatting with you! We hope to see you soon at Innhance Hotels! Have a wonderful day! 🌟";
  }

  // YES
  if (/^(yes|yeah|yep|yup|sure|okay|ok|definitely|absolutely|of course|sounds good|great|perfect)/.test(msg)) {
    return "Awesome! 🎉 Let me know more details so I can assist you better! What would you like to do - book a room, check availability, or something else? 😊";
  }

  // NO
  if (/^(no|nope|nah|not really|never mind|nevermind|nvm|no thanks|no thank you)/.test(msg)) {
    return "No worries at all! 😊 I'm here whenever you need me. Feel free to reach out anytime! Have a great day! 🌟";
  }

  // DEFAULT - unknown message
  const defaults = [
    "Hmm, I didn't quite catch that! 🤔 But I'm here to help with anything related to your stay at Innhance Hotels!\n\nYou can ask me about:\n🛏️ Room booking & availability\n💰 Prices & offers\n⏰ Check-in / Check-out timings\n🏊 Amenities & facilities\n❌ Cancellations\n📍 Location & directions",
    "Oops, I'm still learning! 😅 Could you rephrase that? I can help you with room bookings, prices, amenities, check-in/out and more! 🏨",
    "I want to help but I'm not sure I understood! 🙈 Try asking me about rooms, prices, or facilities and I'll be right on it! 💪",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
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

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${botReply}</Message>
</Response>`;
  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
});