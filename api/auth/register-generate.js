const { generateRegistrationOptions } = require('@simplewebauthn/server');
const { rpName, rpID, setChallengeCookie } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    // PROTECCIÓN: Solo permitimos registrar si NO hay ya un passkey registrado en la BD.
    // Esto asegura que el primer acceso registra al admin, pero luego se bloquea.
    // En una app más robusta, este endpoint estaría protegido por otro factor o bloqueado post-setup.
    const { data: existingKeys, error } = await supabaseAdmin.from('passkey_credentials').select('id').limit(1);
    
    if (error) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    // Si queremos permitir multiples admins, deberíamos tener un sistema de invitación. 
    // Para simplificar: Solo un admin (el primero que se registra).
    if (existingKeys && existingKeys.length > 0) {
        return res.status(403).json({ error: 'Admin is already registered. Setup complete.' });
    }

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: 'admin-1',
        userName: 'admin@sdaichile.com',
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
        },
    });

    setChallengeCookie(res, options.challenge);
    res.status(200).json(options);
};
