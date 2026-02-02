// netlify/functions/notify-user.js
// Отправка уведомлений пользователям

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Типы уведомлений
 */
const NOTIFICATION_TEMPLATES = {
    'order_received': (data) => `
<b>Заказ принят!</b>

Номер: <code>${data.orderId}</code>
Stars: <b>${data.stars}</b>
Сумма: <b>${data.amount} UZS</b>

Мы проверим оплату и свяжемся с вами.
    `.trim(),

    'order_processing': (data) => `
<b>Заказ обрабатывается</b>

Номер: <code>${data.orderId}</code>

Ваш платёж проверен. Stars скоро будут начислены!
    `.trim(),

    'order_completed': (data) => `
<b>Заказ выполнен!</b>

Номер: <code>${data.orderId}</code>
Начислено: <b>${data.stars} Stars</b>

Спасибо за покупку!
    `.trim(),

    'order_rejected': (data) => `
<b>Заказ отклонён</b>

Номер: <code>${data.orderId}</code>
Причина: ${data.reason}

Свяжитесь с поддержкой для уточнения.
    `.trim(),

    'custom': (data) => data.message
};

/**
 * Отправка сообщения в Telegram
 */
async function sendMessage(chatId, text) {
    if (!BOT_TOKEN) {
        return { success: false, error: 'Bot token not configured' };
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });

        const result = await response.json();
        return { success: result.ok, data: result };
    } catch (error) {
        console.error('Ошибка отправки:', error);
        return { success: false, error: error.message };
    }
}

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
        const { telegramUsername, notificationType, data, adminToken } = JSON.parse(event.body);

        // Проверка авторизации
        if (adminToken !== process.env.ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Неавторизованный доступ' })
            };
        }

        // Валидация
        if (!telegramUsername || !notificationType) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Не указаны обязательные поля' })
            };
        }

        // Получаем шаблон сообщения
        const template = NOTIFICATION_TEMPLATES[notificationType];
        if (!template) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Неизвестный тип уведомления' })
            };
        }

        // Формируем сообщение
        const message = template(data || {});

        // Отправляем
        const chatId = `@${telegramUsername.replace('@', '')}`;
        const result = await sendMessage(chatId, message);

        if (!result.success) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Не удалось отправить уведомление',
                    details: result.error
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Уведомление отправлено',
                recipient: telegramUsername
            })
        };

    } catch (error) {
        console.error('Ошибка уведомления:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Внутренняя ошибка сервера' })
        };
    }
};
