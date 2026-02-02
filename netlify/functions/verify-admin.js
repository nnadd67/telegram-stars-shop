exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'No data received' }) };
        }

        const data = JSON.parse(event.body);
        const password = data.password;

        // Пароль: либо из настроек, либо резервный
        const CORRECT_PASSWORD = process.env.ADMIN_PASSWORD || 'safiyevT7';

        if (password && String(password).trim() === CORRECT_PASSWORD) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, token: 'session_ok' })
            };
        } else {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Неверный пароль' })
            };
        }
    } catch (error) {
        console.error('Verify Auth Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
