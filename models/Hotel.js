const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  whatsappNumber: { type: String, required: true, unique: true },

  // Bot personality & knowledge
  botConfig: {
    assistantName: { type: String, default: 'Inna' },
    systemPrompt: { type: String, required: true },
  },

  // Room types this hotel offers
  rooms: [
    {
      type: { type: String },       // e.g. "Standard", "Deluxe", "Suite"
      price: { type: Number },      // per night
      totalRooms: { type: Number }, // how many rooms of this type
    }
  ],

  // Hotel & room images
  images: {
    lobby: { type: String },
    standardRoom: { type: String },
    deluxeRoom: { type: String },
    suite: { type: String },
  },

  // Subscription
  plan: { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
  isActive: { type: Boolean, default: true },

}, { timestamps: true });

module.exports = mongoose.model('Hotel', hotelSchema);