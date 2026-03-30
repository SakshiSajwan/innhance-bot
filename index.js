require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const verifyToken = require('./middleware/authMiddleware');
const bookingRoutes = require('./routes/booking');
const roomsRoute = require('./routes/rooms');

// ===== CONNECT TO MONGODB =====
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected');
    try {
      await mongoose.connection.syncIndexes();
      console.log('MongoDB indexes synced');
    } catch (err) {
      console.log('MongoDB index sync skipped', err.message);
    }
  })
  .catch(err => console.log('MongoDB Error', err));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== ROUTES =====
app.use('/rooms', roomsRoute);
app.use('/booking', bookingRoutes);
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/webhook', require('./routes/webhook'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/analytics', require('./routes/analytics'));

// ===== PROTECTED ROUTE =====
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({ message: 'Protected data accessed', user: req.user });
});

app.get('/', (req, res) => res.send('Innhance Bot is running!'));

// ===== START SERVER =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
