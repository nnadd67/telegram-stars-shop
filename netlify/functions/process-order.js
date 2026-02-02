// netlify/functions/process-order.js
// Обработка новых заказов

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

/**
 * Генерация номера заказа
 */
function generateOrderId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'ORD-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Форматирование цены
 */
function formatPrice(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount);
}

/**
 * Отправка уведомления с кнопками админу в Telegram
 */
async function notifyAdminNewOrder(order) {
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
        console.warn('Telegram бот не настроен');
        return { success: false };
    }

    const message = `
<b>🆕 НОВЫЙ ЗАКАЗ!</b>

📦 Номер: <code>${order.orderId}</code>
👤 Telegram: @${order.telegramUsername}
⭐ Stars: <b>${order.stars}</b>
💰 Сумма: <b>${formatPrice(order.amount)} UZS</b>
💳 Оплата: Перевод на карту
⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}

Проверьте скриншот оплаты и подтвердите заказ.
    `.trim();

    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ Подтвердить', callback_data: `confirm_${order.orderId}` },
                { text: '❌ Отклонить', callback_data: `reject_${order.orderId}` }
            ],
            [
                { text: '📋 Подробнее', callback_data: `details_${order.orderId}` }
            ]
        ]
    };

    try {
        // Если есть скриншот - отправляем с фото
        if (order.screenshot) {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_CHAT_ID,
                    photo: order.screenshot,
                    caption: message,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                })
            });
            return { success: (await response.json()).ok };
        } else {
            // Без фото
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_CHAT_ID,
                    text: message,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                })
            });
            return { success: (await response.json()).ok };
        }
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Уведомление пользователя о принятии заказа
 */
async function notifyUser(username, orderId, stars) {
    if (!BOT_TOKEN) return;

    const message = `
<b>⏳ Ваш заказ принят!</b>

📦 Номер заказа: <code>${orderId}</code>
⭐ Stars: <b>${stars}</b>

Мы проверим оплату и начислим Stars в течение <b>5-15 минут</b>.

<b>Сохраните номер заказа!</b>
Он понадобится для проверки статуса.
    `.trim();

    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: `@${username.replace('@', '')}`,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (error) {
        console.log('Не удалось уведомить пользователя напрямую:', error.message);
    }
}

/**
 * Основная функция Netlify
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
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
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    // 1. АНТИ-СПАМ (Rate Limiting)
    const clientIP = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    if (requestLog.has(clientIP)) {
        const lastRequest = requestLog.get(clientIP);

        // Если прошло меньше минуты
        if (now - lastRequest < RATE_LIMIT_TIME) {
            console.log(`SPAM BLOCKED: ${clientIP}`);
            return {
                statusCode: 429,
                body: JSON.stringify({ success: false, error: 'Слишком много запросов. Подождите 1 минуту.' })
            };
        }
    }
    // Записываем время запроса
    requestLog.set(clientIP, now);

    try {
        const data = JSON.parse(event.body);

        // Валидация
        if (!data.telegramUsername || !data.stars || !data.amount) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Неверные данные' }) };
        }

        const orderId = `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const order = {
            orderId,
            telegramUsername: data.telegramUsername.replace('@', ''),
            stars: data.stars,
            amount: data.amount,
            screenshot: data.screenshot, // base64
            paymentMethod: data.paymentMethod,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Сохраняем заказ в кэш (импорт из webhook)
        // В реальном serverless это сложно, поэтому мы просто надеемся что инстанс жив,
        // ИЛИ просто отправляем данные в телеграм, где они и будут "храниться" в чате.
        // Для кнопок нам нужно, чтобы webhook знал о заказе.
        try {
            const webhook = require('./telegram-webhook');
            webhook.ordersCache.push(order);
        } catch (e) {
            console.error('Ошибка сохранения в кэш:', e);
        }

        // Отправляем уведомление админу
        await sendTelegramNotify(order);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, orderId: orderId })
        };

    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
