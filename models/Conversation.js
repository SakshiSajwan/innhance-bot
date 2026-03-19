const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  phone: { type: String, required: true },

  messages: [
    {
      role: { type: String, enum: ['user', 'assistant'] },
      content: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],

  // Is a booking currently in progress?
  bookingState: {
    inProgress: { type: Boolean, default: false },
    collectedData: { type: Object, default: {} }  // partial booking data
  }

}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);