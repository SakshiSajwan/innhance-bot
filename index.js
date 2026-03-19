require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

const PORT = process.env.PORT || 8080;

// Routes
app.get('/', (req, res) => res.send('Innhance Platform is running! 🏨'));
app.use('/webhook', require('./routes/webhook'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
});