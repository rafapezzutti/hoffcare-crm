require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'https://*.onrender.com'],
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`HoffCare API running on port ${PORT}`));
