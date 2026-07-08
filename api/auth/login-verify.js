const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { rpID, origin, getChallengeCookie, clearChallengeCookie, setSessionCookie } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body;
    const expectedChallenge = getChallengeCookie(req);

    if (!expectedChallenge) {
        return res.status(400).json({ error: 'Session expired or challenge missing' });
    }

    try {
        // Recuperar la credencial de la DB
        const { data: credentials, error } = await supabaseAdmin
            .from('passkey_credentials')
            .select('*')
            .eq('credential_id', body.id)
            .limit(1);

        if (error || !credentials || credentials.length === 0) {
            return res.status(400).json({ error: 'Authenticator is not registered with this site' });
        }

        const authenticator = credentials[0];
        const publicKeyBuffer = Buffer.from(authenticator.public_key, 'base64url');

        let verification;
        try {
            verification = await verifyAuthenticationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                credential: {
                    id: authenticator.credential_id, // Base64URL encoded string
                    publicKey: publicKeyBuffer,      // Uint8Array / Buffer
                    counter: Number(authenticator.counter),
                    transports: authenticator.transports
                },
            });
        } catch (error) {
            console.error('Verification detailed error:', error);
            return res.status(400).json({ error: 'Verification detailed error: ' + error.message + '\nStack: ' + error.stack });
        }

        if (verification.verified) {
            const { authenticationInfo } = verification;
            const { newCounter } = authenticationInfo;

            // Actualizar el counter en la DB para prevenir ataques de clonación
            await supabaseAdmin
                .from('passkey_credentials')
                .update({ counter: newCounter })
                .eq('credential_id', authenticator.credential_id);

            // Emitir JWT de sesión
            setSessionCookie(res, { role: 'admin', user_id: authenticator.user_id });
            clearChallengeCookie(res);
            
            return res.status(200).json({ verified: true });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(400).json({ error: 'Login error: ' + error.message + '\nStack: ' + error.stack });
    }

    return res.status(400).json({ error: 'Login failed' });
};
