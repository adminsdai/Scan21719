const { generateAuthenticationOptions } = require('@simplewebauthn/server');
const { rpID, setChallengeCookie } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    // Buscar la credencial registrada del admin
    const { data: credentials, error } = await supabaseAdmin.from('passkey_credentials').select('credential_id, transports').limit(1);

    if (error || !credentials || credentials.length === 0) {
        // Si no hay admin registrado, devolvemos error (o podríamos indicar que debe configurarse)
        return res.status(404).json({ error: 'No admin configured. Please run setup first.' });
    }

    const allowCredentials = credentials.map(cred => ({
        id: Buffer.from(cred.credential_id, 'base64url'),
        type: 'public-key',
        transports: cred.transports,
    }));

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: 'preferred',
    });

    setChallengeCookie(res, options.challenge);
    res.status(200).json(options);
};
