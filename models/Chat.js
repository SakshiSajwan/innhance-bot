const mongoose = require('mongoose');

// Schema for individual messages
const messageSchema = new mongoose.Schema({
  role: { 
    type: String, 
    enum: ['user', 'assistant'], 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  time: { 
    type: String // Stores time like "10:00 AM"
  }
});

// Schema for the entire conversation
const chatSchema = new mongoose.Schema({
  name: { type: String, default: 'New Customer' },
  phone: { type: String, required: true, unique: true },
  lastMessage: { type: String, default: '' },
  time: { type: String, default: 'Just now' }, // e.g., "2 min ago" or "10:05 AM"
  unread: { type: Number, default: 0 },
  status: { type: String, enum: ['booked', 'inquiry', 'cancelled'], default: 'inquiry' },
  avatar: { type: String, default: 'U' },
  messages: [messageSchema]
}, { timestamps: true }); 
// timestamps: true will automatically add createdAt and updatedAt

module.exports = mongoose.model('Chat', chatSchema);