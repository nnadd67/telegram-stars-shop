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

    try {
        const data = JSON.parse(event.body);
        console.log('📥 Новый заказ:', data);

        // Валидация обязательных полей
        const { telegramUsername, stars, amount, paymentMethod, screenshot } = data;

        if (!telegramUsername || !stars || !amount) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Заполните все обязательные поля',
                    fields: { telegramUsername, stars, amount }
                })
            };
        }

        // Валидация username
        const usernamePattern = /^[a-zA-Z0-9_]{5,32}$/;
        const cleanUsername = telegramUsername.replace('@', '');

        if (!usernamePattern.test(cleanUsername)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Некорректный Telegram username' })
            };
        }

        // Генерация ID заказа
        const orderId = generateOrderId();

        // Создание объекта заказа
        const order = {
            orderId,
            telegramUsername: cleanUsername,
            stars: parseInt(stars),
            amount: parseFloat(amount),
            paymentMethod: paymentMethod || 'Перевод на карту',
            screenshot: screenshot || null,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        console.log('✅ Заказ создан:', orderId);

        // Отправляем уведомление админу в Telegram с кнопками
        const adminNotification = await notifyAdminNewOrder(order);
        console.log('📤 Уведомление админу:', adminNotification);

        // Уведомляем пользователя
        await notifyUser(cleanUsername, orderId, order.stars);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                orderId,
                message: 'Заказ успешно создан! Ожидайте подтверждения.',
                estimatedTime: '5-15 минут'
            })
        };

    } catch (error) {
        console.error('❌ Ошибка обработки заказа:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Внутренняя ошибка сервера' })
        };
    }
};
