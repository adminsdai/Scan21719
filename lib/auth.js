const { supabaseAdmin } = require('./supabase');
const jwt = require('jsonwebtoken');
const { serialize, parse } = require('cookie');

const rpName = 'SDAI Chile Admin';
// En producción, rpID debería ser scan.sdaichile.com, en desarrollo localhost
const rpID = process.env.VERCEL_ENV === 'production' ? 'scan.sdaichile.com' : 'localhost';
const origin = process.env.VERCEL_ENV === 'production' ? 'https://scan.sdaichile.com' : 'http://localhost:3000';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key-change-me';

// Helpers para sesiones usando Cookies (JWT)
function setSessionCookie(res, payload) {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    const cookieString = serialize('admin_session', token, {
        httpOnly: true,
        secure: process.env.VERCEL_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8 // 8 hours
    });
    res.setHeader('Set-Cookie', cookieString);
}

function verifySession(req) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.admin_session;
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

// Helpers para almacenar temporalmente los "challenges" de WebAuthn
// Vercel Serverless es stateless, no podemos guardar en memoria. 
// Deberíamos guardarlos en la cookie temporalmente durante el handshake.
function setChallengeCookie(res, challenge) {
    const cookieString = serialize('webauthn_challenge', challenge, {
        httpOnly: true,
        secure: process.env.VERCEL_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 300 // 5 minutes
    });
    // Si ya existe otra cookie (ej. Set-Cookie header ya existe), Vercel espera un Array
    let existing = res.getHeader('Set-Cookie') || [];
    if (!Array.isArray(existing)) existing = [existing];
    res.setHeader('Set-Cookie', [...existing, cookieString]);
}

function getChallengeCookie(req) {
    const cookies = parse(req.headers.cookie || '');
    return cookies.webauthn_challenge;
}

function clearChallengeCookie(res) {
    const cookieString = serialize('webauthn_challenge', '', {
        httpOnly: true,
        secure: process.env.VERCEL_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: -1
    });
    let existing = res.getHeader('Set-Cookie') || [];
    if (!Array.isArray(existing)) existing = [existing];
    res.setHeader('Set-Cookie', [...existing, cookieString]);
}

module.exports = { 
    rpName, 
    rpID, 
    origin, 
    setSessionCookie, 
    verifySession, 
    setChallengeCookie, 
    getChallengeCookie, 
    clearChallengeCookie 
};
