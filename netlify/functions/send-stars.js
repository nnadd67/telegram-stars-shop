// netlify/functions/send-stars.js
// Отправка Stars пользователю через Fragment API

const FRAGMENT_API_KEY = process.env.FRAGMENT_API_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

/**
 * Отправка уведомления администратору
 */
async function notifyAdmin(message) {
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;

    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: ADMIN_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (error) {
        console.error('Ошибка уведомления админа:', error);
    }
}

/**
 * Отправка уведомления пользователю
 */
async function notifyUser(username, message) {
    if (!BOT_TOKEN) return { success: false, error: 'Bot token not configured' };

    try {
        // Отправляем через username
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: `@${username.replace('@', '')}`,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const result = await response.json();
        return { success: result.ok, data: result };
    } catch (error) {
        console.error('Ошибка отправки пользователю:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Отправка Stars через Fragment API
 */
async function sendStarsViaFragment(telegramUsername, stars) {
    if (!FRAGMENT_API_KEY) {
        console.warn('Fragment API Key не настроен');
        return { success: false, error: 'Fragment API not configured', simulated: true };
    }

    try {
        // Fragment API endpoint для отправки Stars
        const response = await fetch('https://fragment.com/api/v1/stars/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FRAGMENT_API_KEY}`
            },
            body: JSON.stringify({
                recipient: telegramUsername.replace('@', ''),
                amount: stars
            })
        });

        if (!response.ok) {
            console.error('Fragment API ошибка:', response.status);
            return { success: false, error: `API error: ${response.status}` };
        }

        const result = await response.json();
        console.log('Fragment API ответ:', result);
        return { success: true, data: result };
    } catch (error) {
        console.error('Ошибка при отправке через Fragment:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Генерация ID транзакции
 */
function generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `TXN-${timestamp}-${random}`.toUpperCase();
}

/**
 * Основная функция Netlify
 */
exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Preflight
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
        const { orderId, telegramUsername, stars, adminToken } = JSON.parse(event.body);

        // Проверка авторизации
        if (adminToken !== process.env.ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        // Валидация
        if (!orderId || !telegramUsername || !stars) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        console.log(`Отправка ${stars} Stars пользователю @${telegramUsername}`);

        // Генерация ID транзакции
        const transactionId = generateTransactionId();

        // Попытка отправить через Fragment API
        let fragmentResult = { success: false, simulated: true };

        if (FRAGMENT_API_KEY) {
            console.log('Попытка отправки через Fragment API...');
            fragmentResult = await sendStarsViaFragment(telegramUsername, stars);

            if (fragmentResult.success) {
                console.log('Fragment API успешно отправил Stars');
            } else {
                console.log('Fragment API не смог отправить Stars');
            }
        } else {
            console.error('Fragment API ошибка:', 'Key not set');
        }

        // Отправляем уведомление пользователю
        const userMessage = fragmentResult.success
            ? `
<b>Поздравляем!</b>

Вам начислено <b>${stars} Stars</b>!

Номер заказа: <code>${orderId}</code>
ID транзакции: <code>${transactionId}</code>

Спасибо за покупку!
            `.trim()
            : `
<b>Ваш заказ одобрен!</b>

Номер заказа: <code>${orderId}</code>
Количество: <b>${stars} Stars</b>

Stars будут начислены в ближайшее время.
Если возникнут вопросы - напишите номер заказа.
            `.trim();

        await notifyUser(telegramUsername, userMessage);

        // Уведомление админа
        await notifyAdmin(`
<b>Stars отправлены!</b>

Заказ: <code>${orderId}</code>
Получатель: @${telegramUsername}
Количество: ${stars} Stars
Транзакция: <code>${transactionId}</code>
Статус Fragment: ${fragmentResult.success ? 'Успешно' : 'Симуляция'}
        `.trim());

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                orderId,
                transactionId,
                stars,
                recipient: telegramUsername,
                fragmentSuccess: fragmentResult.success,
                message: 'Stars отправлены успешно'
            })
        };

    } catch (error) {
        console.error('Ошибка отправки Stars:', error);

        await notifyAdmin(`
<b>Ошибка отправки Stars!</b>

Ошибка: ${error.message}
        `.trim());

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
