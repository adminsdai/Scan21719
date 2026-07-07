const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Importar controladores de la carpeta api para homologar local con Vercel
const scanHandler = require('./api/scan');
const consentHandler = require('./api/consent');
const logsHandler = require('./api/admin/logs');
const registerGenerateHandler = require('./api/auth/register-generate');
const registerVerifyHandler = require('./api/auth/register-verify');
const loginGenerateHandler = require('./api/auth/login-generate');
const loginVerifyHandler = require('./api/auth/login-verify');
const sessionHandler = require('./api/auth/session');
const loginPasswordHandler = require('./api/auth/login-password');
const logoutHandler = require('./api/auth/logout');

// Rutas de API
app.get('/api/scan', scanHandler);
app.post('/api/consent', consentHandler);
app.get('/api/admin/logs', logsHandler);
app.get('/api/auth/register-generate', registerGenerateHandler);
app.post('/api/auth/register-verify', registerVerifyHandler);
app.get('/api/auth/login-generate', loginGenerateHandler);
app.post('/api/auth/login-verify', loginVerifyHandler);
app.get('/api/auth/session', sessionHandler);
app.post('/api/auth/login-password', loginPasswordHandler);
app.post('/api/auth/logout', logoutHandler);

// Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
