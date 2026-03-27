const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat'); // Import the model we just created

// 1. Get all chats from Database
router.get('/', async (req, res) => {
  try {
    // Fetch all chats, sorted by latest updated first
    const chats = await Chat.find().sort({ updatedAt: -1 });
    
    // Map _id to id so our React frontend doesn't break
    const formattedChats = chats.map(chat => ({
      id: chat._id,
      name: chat.name,
      phone: chat.phone,
      lastMessage: chat.lastMessage,
      time: chat.time,
      unread: chat.unread,
      status: chat.status,
      avatar: chat.avatar,
      messages: chat.messages
    }));

    res.json(formattedChats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// 2. Mark a specific chat as read
router.post('/:id/read', async (req, res) => {
  try {
    await Chat.findByIdAndUpdate(req.params.id, { unread: 0 });
    res.status(200).json({ message: 'Chat marked as read' });
  } catch (error) {
    res.status(500).json({ error: "Failed to update chat" });
  }
});

// 3. Mark all chats as read
router.post('/mark-all-read', async (req, res) => {
  try {
    await Chat.updateMany({}, { unread: 0 });
    res.status(200).json({ message: 'All chats marked as read' });
  } catch (error) {
    res.status(500).json({ error: "Failed to update all chats" });
  }
});

module.exports = router;