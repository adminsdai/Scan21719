const { verifySession } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    // Proteger todos los métodos con JWT de sesión activa
    const session = verifySession(req);
    if (!session || session.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized. Valid Passkey session required.' });
    }

    // =========================================================
    // GET: Obtener usuarios autorizados y llaves registradas
    // =========================================================
    if (req.method === 'GET') {
        try {
            const [usersResult, keysResult] = await Promise.all([
                supabaseAdmin
                    .from('authorized_users')
                    .select('user_id, role, created_at')
                    .order('created_at', { ascending: true }),
                supabaseAdmin
                    .from('passkey_credentials')
                    .select('id, user_id, created_at, transports')
                    .order('created_at', { ascending: false })
            ]);

            if (usersResult.error) throw usersResult.error;
            if (keysResult.error) throw keysResult.error;

            return res.status(200).json({
                authorized_users: usersResult.data,
                passkeys: keysResult.data
            });
        } catch (error) {
            console.error('Security GET error:', error);
            return res.status(500).json({ error: 'Error al obtener configuración: ' + error.message });
        }
    }

    // =========================================================
    // POST: Agregar un nuevo usuario autorizado
    // =========================================================
    if (req.method === 'POST') {
        const { user_id, role = 'admin' } = req.body || {};

        if (!user_id || !user_id.includes('@')) {
            return res.status(400).json({ error: 'Correo electrónico inválido.' });
        }

        try {
            const { error } = await supabaseAdmin
                .from('authorized_users')
                .insert([{ user_id: user_id.toLowerCase().trim(), role }]);

            if (error) {
                if (error.code === '23505') { // unique_violation
                    return res.status(409).json({ error: 'Este usuario ya está autorizado.' });
                }
                throw error;
            }

            return res.status(201).json({ success: true, message: `Usuario ${user_id} autorizado correctamente.` });
        } catch (error) {
            console.error('Security POST error:', error);
            return res.status(500).json({ error: 'Error al autorizar usuario: ' + error.message });
        }
    }

    // =========================================================
    // DELETE: Revocar un usuario o una llave específica
    // =========================================================
    if (req.method === 'DELETE') {
        const { type, id } = req.body || {};

        if (!type || !id) {
            return res.status(400).json({ error: 'Faltan parámetros: type e id son requeridos.' });
        }

        // Protección: no permitir borrar al usuario de la sesión activa
        if (type === 'user' && id === session.user_id) {
            return res.status(403).json({ error: 'No puedes eliminar tu propio usuario activo.' });
        }

        try {
            if (type === 'user') {
                // Eliminar todas las llaves asociadas al usuario primero
                await supabaseAdmin
                    .from('passkey_credentials')
                    .delete()
                    .eq('user_id', id);

                // Luego eliminar el usuario autorizado
                const { error } = await supabaseAdmin
                    .from('authorized_users')
                    .delete()
                    .eq('user_id', id);

                if (error) throw error;
                return res.status(200).json({ success: true, message: `Usuario ${id} y sus llaves han sido eliminados.` });
            }

            if (type === 'passkey') {
                // Revocar una llave biométrica específica por su UUID
                const { error } = await supabaseAdmin
                    .from('passkey_credentials')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                return res.status(200).json({ success: true, message: 'Llave biométrica revocada.' });
            }

            return res.status(400).json({ error: 'Tipo de revocación inválido. Use "user" o "passkey".' });
        } catch (error) {
            console.error('Security DELETE error:', error);
            return res.status(500).json({ error: 'Error al revocar: ' + error.message });
        }
    }

    return res.status(405).json({ error: 'Método no permitido.' });
};
