// netlify/functions/reject-order.js
// Отклонение заказа администратором

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

/**
 * Причины отклонения
 */
const REJECT_REASONS = {
    'invalid_screenshot': 'Некорректный или нечитаемый скриншот',
    'payment_not_found': 'Платёж не найден в системе банка',
    'amount_mismatch': 'Сумма платежа не совпадает с заказом',
    'duplicate_order': 'Дубликат заказа (уже обработан)',
    'fraud_suspected': 'Подозрение на мошенничество',
    'other': 'Другая причина'
};

/**
 * Уведомление пользователя об отклонении
 */
async function notifyUser(username, orderId, reason, customMessage) {
    if (!BOT_TOKEN) return { success: false };

    const reasonText = REJECT_REASONS[reason] || reason;

    const message = `
<b>Заказ отклонён</b>

Номер заказа: <code>${orderId}</code>

<b>Причина:</b> ${reasonText}
${customMessage ? `\n<b>Комментарий:</b> ${customMessage}` : ''}

Если вы считаете это ошибкой, свяжитесь с поддержкой.
Отправьте номер заказа в этот чат.
    `.trim();

    try {
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
        return { success: result.ok };
    } catch (error) {
        console.error('Ошибка уведомления пользователя:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Уведомление администратора
 */
async function notifyAdmin(orderId, username, reason) {
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;

    const message = `
<b>Заказ отклонён</b>

Номер: <code>${orderId}</code>
Пользователь: @${username}
Причина: ${REJECT_REASONS[reason] || reason}
    `.trim();

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
        const { orderId, telegramUsername, reason, customMessage, adminToken } = JSON.parse(event.body);

        // Проверка авторизации
        if (adminToken !== process.env.ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Неавторизованный доступ' })
            };
        }

        // Валидация
        if (!orderId || !telegramUsername || !reason) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Не указаны обязательные поля' })
            };
        }

        console.log(`Отклонение заказа ${orderId}, причина: ${reason}`);

        // Уведомляем пользователя
        const userNotification = await notifyUser(
            telegramUsername,
            orderId,
            reason,
            customMessage
        );

        // Уведомляем админа
        await notifyAdmin(orderId, telegramUsername, reason);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                orderId,
                status: 'rejected',
                reason: REJECT_REASONS[reason] || reason,
                userNotified: userNotification.success,
                message: 'Заказ успешно отклонён'
            })
        };

    } catch (error) {
        console.error('Ошибка отклонения заказа:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Внутренняя ошибка сервера' })
        };
    }
};
