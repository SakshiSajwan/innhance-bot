const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  whatsappNumber: { type: String },               // display number e.g. +91 98765 43210
  whatsappPhoneNumberId: { type: String, unique: true }, // Meta phone number ID

  // Bot personality & knowledge
  botConfig: {
    assistantName: { type: String, default: 'Inna' },
    systemPrompt: { type: String, required: true },
  },

  // Room types this hotel offers
  rooms: [
    {
      name: { type: String },   // rename from type → name
      price: { type: Number },

      totalRooms: { type: Number },
      availableRooms: { type: Number },

      description: { type: String },

      amenities: [{ type: String }],

      image: { type: String },

      roomNumbers: [
        {
          num: { type: String },
          booked: { type: Boolean, default: false }
        }
      ]
    }
  ], // <--- Added the missing comma here!

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