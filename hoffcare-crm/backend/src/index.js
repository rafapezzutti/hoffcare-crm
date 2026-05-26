require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'https://hoffcare-crm.onrender.com',
  'https://psaude.ia.br',
  'https://www.psaude.ia.br',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: Postman, Render Shell)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /\.onrender\.com$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clinics', require('./routes/clinics'));
app.use('/api/professionals', require('./routes/professionals'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/procedures', require('./routes/procedures'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/records', require('./routes/records'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api/autonomous', require('./routes/autonomous'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/rentals', require('./routes/rentals'));
app.use('/api/settlements', require('./routes/settlements'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`HoffCare API running on port ${PORT}`));
