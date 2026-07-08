const { verifyRegistrationResponse } = require('@simplewebauthn/server');
const { rpID, origin, getChallengeCookie, clearChallengeCookie } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { username, ...body } = req.body; // Extraer el username enviado por el cliente
    const expectedChallenge = getChallengeCookie(req);

    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Falta especificar el usuario autorizado.' });
    }

    if (!expectedChallenge) {
        return res.status(400).json({ error: 'Session expired or challenge missing' });
    }

    try {
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });

        if (verification.verified) {
            const { registrationInfo } = verification;
            if (!registrationInfo || !registrationInfo.credential) {
                return res.status(400).json({ error: 'Falta la información de la credencial en la respuesta.' });
            }
            const { credential } = registrationInfo;
            const { id, publicKey, counter } = credential;

            // Convertir a base64url strings para guardar en la BD
            const base64CredentialID = Buffer.from(id).toString('base64url');
            const base64PublicKey = Buffer.from(publicKey).toString('base64url');
            const transports = body.response.transports || [];

            // Guardar la credencial asociada al user_id autorizado en Supabase
            const { error } = await supabaseAdmin.from('passkey_credentials').insert([{
                credential_id: base64CredentialID,
                public_key: base64PublicKey,
                counter: counter,
                transports: transports,
                user_id: username
            }]);

            if (error) {
                console.error('Supabase error inserting passkey:', error);
                return res.status(500).json({ error: 'Error saving credential to database' });
            }

            clearChallengeCookie(res);
            return res.status(200).json({ verified: true });
        }
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(400).json({ error: error.message });
    }

    return res.status(400).json({ error: 'Verification failed' });
};
