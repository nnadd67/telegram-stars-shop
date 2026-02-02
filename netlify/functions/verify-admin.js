// netlify/functions/verify-admin.js
// Проверка авторизации администратора

/**
 * Основная функция Netlify
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { password } = JSON.parse(event.body);

        if (!password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Пароль не указан' })
            };
        }

        // Проверка пароля
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            console.error('ADMIN_PASSWORD не настроен в окружении');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Сервер не настроен' })
            };
        }

        if (password !== adminPassword) {
            console.log('Неудачная попытка входа');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Неверный пароль' })
            };
        }

        // Успешная авторизация
        console.log('Успешный вход администратора');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Авторизация успешна',
                token: password, // В продакшене использовать JWT
                expiresIn: 3600 // 1 час
            })
        };

    } catch (error) {
        console.error('Ошибка авторизации:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Внутренняя ошибка сервера' })
        };
    }
};
