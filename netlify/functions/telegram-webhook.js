// netlify/functions/telegram-webhook.js
// Telegram бот для управления заказами Stars

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID; // ID канала для логов (например @drip_logs или -100...)
const ADMIN_SECRET = process.env.ADMIN_SECRET_COMMAND || '/getadmin111';

// Хранение заказов (в production - база данных)
let ordersCache = [];

/**
 * Отправка сообщения через Telegram Bot API
 */
async function sendMessage(chatId, text, options = {}) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                ...options
            })
        });

        return await response.json();
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        return { ok: false, error: error.message };
    }
}

/**
 * Отправка фото
 */
async function sendPhoto(chatId, photoUrl, caption, options = {}) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                photo: photoUrl,
                caption: caption,
                parse_mode: 'HTML',
                ...options
            })
        });

        return await response.json();
    } catch (error) {
        console.error('Ошибка отправки фото:', error);
        return { ok: false, error: error.message };
    }
}

/**
 * Ответ на callback query
 */
async function answerCallback(callbackQueryId, text, showAlert = false) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: text,
            show_alert: showAlert
        })
    });
}

/**
 * Отправка лога в канал
 */
async function sendLogToChannel(order) {
    if (!LOGS_CHANNEL_ID) return;

    const message = `
<b>Order ID:</b> #${order.orderId}
<b>Type:</b> stars ⭐
<b>Amount:</b> ${order.stars} звезд 💸
<b>Price:</b> ${formatPrice(order.amount)} 🏷️
<b>Status:</b> ✅ Completed
<b>Time:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}
    `.trim();

    await sendMessage(LOGS_CHANNEL_ID, message);
}

/**
 * Редактирование сообщения
 */
async function editMessage(chatId, messageId, text, replyMarkup = null) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;

    const body = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML'
    };

    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

/**
 * Проверка, является ли пользователь админом
 */
function isAdmin(chatId) {
    return String(chatId) === String(ADMIN_CHAT_ID);
}

/**
 * Форматирование суммы
 */
function formatPrice(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount);
}

/**
 * Команда /start
 */
async function handleStart(chatId, username) {
    const isAdminUser = isAdmin(chatId);

    let message = `
<b>⭐ Добро пожаловать в Telegram Stars Shop!</b>

Здесь вы можете купить Telegram Stars по выгодным ценам.

<b>Доступные команды:</b>
/start - Главное меню
/help - Помощь
/status - Проверить статус заказа
    `.trim();

    if (isAdminUser) {
        message += `

<b>🔐 Админ-команды:</b>
/orders - Список ожидающих заказов
/stats - Статистика
/pending - Ожидающие подтверждения`;
    }

    await sendMessage(chatId, message);
}

/**
 * Команда /help
 */
async function handleHelp(chatId) {
    const message = `
<b>📖 Помощь</b>

<b>Как купить Stars:</b>
1. Перейдите на наш сайт
2. Выберите пакет Stars
3. Введите ваш @username
4. Оплатите на карту Humo
5. Загрузите скриншот чека
6. Дождитесь подтверждения (5-15 мин)

<b>Проверка статуса:</b>
Отправьте номер заказа в формате:
<code>ORD-XXXXXX</code>

<b>Проблемы?</b>
Напишите номер заказа — мы поможем!
    `.trim();

    await sendMessage(chatId, message);
}

/**
 * Команда /orders - список ожидающих заказов (только для админа)
 */
async function handleOrders(chatId) {
    if (!isAdmin(chatId)) {
        await sendMessage(chatId, '❌ У вас нет доступа к этой команде');
        return;
    }

    // В реальном проекте - запрос к базе данных
    const pendingOrders = ordersCache.filter(o => o.status === 'pending');

    if (pendingOrders.length === 0) {
        await sendMessage(chatId, '📭 Нет ожидающих заказов');
        return;
    }

    let message = `<b>⏳ Ожидающие заказы (${pendingOrders.length}):</b>\n\n`;

    for (const order of pendingOrders.slice(0, 10)) {
        message += `
📦 <code>${order.orderId}</code>
👤 @${order.username}
⭐ ${order.stars} Stars
💰 ${formatPrice(order.amount)} UZS
⏰ ${new Date(order.createdAt).toLocaleString('ru-RU')}
─────────────────
`;
    }

    await sendMessage(chatId, message.trim());
}

/**
 * Отправка уведомления админу о новом заказе
 */
async function notifyAdminNewOrder(order) {
    if (!ADMIN_CHAT_ID) return;

    const message = `
<b>🆕 Новый заказ!</b>

📦 Номер: <code>${order.orderId}</code>
👤 Username: @${order.username}
⭐ Stars: <b>${order.stars}</b>
💰 Сумма: <b>${formatPrice(order.amount)} UZS</b>
💳 Оплата: ${order.paymentMethod || 'Перевод на карту'}
⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}

Проверьте скриншот и подтвердите заказ.
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

    // Если есть скриншот - отправляем с фото
    if (order.screenshot) {
        await sendPhoto(ADMIN_CHAT_ID, order.screenshot, message, { reply_markup: keyboard });
    } else {
        await sendMessage(ADMIN_CHAT_ID, message, { reply_markup: keyboard });
    }
}

/**
 * Уведомление пользователя о статусе заказа
 */
async function notifyUser(username, status, orderId, stars, reason = '') {
    let message = '';

    switch (status) {
        case 'confirmed':
            message = `
<b>✅ Заказ подтверждён!</b>

Номер: <code>${orderId}</code>
Начислено: <b>${stars} Stars</b>

Спасибо за покупку! ⭐
            `.trim();
            break;

        case 'rejected':
            message = `
<b>❌ Заказ отклонён</b>

Номер: <code>${orderId}</code>
${reason ? `Причина: ${reason}` : ''}

Если считаете это ошибкой - напишите нам.
            `.trim();
            break;

        case 'pending':
            message = `
<b>⏳ Заказ принят!</b>

Номер: <code>${orderId}</code>
Stars: <b>${stars}</b>

Мы проверим оплату и начислим Stars в течение 5-15 минут.
Сохраните номер заказа!
            `.trim();
            break;
    }

    // Отправляем по username
    try {
        await sendMessage(`@${username.replace('@', '')}`, message);
    } catch (error) {
        console.log('Не удалось отправить пользователю:', error.message);
    }
}

/**
 * Обработка callback кнопок
 */
async function handleCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.id;
    const data = callbackQuery.data;
    const callbackId = callbackQuery.id;

    // Проверка прав админа
    if (!isAdmin(chatId)) {
        await answerCallback(callbackId, '❌ Нет доступа', true);
        return;
    }

    // Парсим действие и orderId
    const [action, orderId] = data.split('_');

    if (action === 'confirm') {
        // Подтверждение заказа
        await answerCallback(callbackId, '⏳ Подтверждаем заказ...');

        // Находим заказ
        const order = ordersCache.find(o => o.orderId === orderId);

        if (order) {
            order.status = 'confirmed';

            // Уведомляем пользователя
            await notifyUser(order.username, 'confirmed', orderId, order.stars);

            // Обновляем сообщение админа
            await editMessage(chatId, messageId, `
<b>✅ ЗАКАЗ ПОДТВЕРЖДЁН</b>

📦 Номер: <code>${orderId}</code>
👤 @${order.username}
⭐ ${order.stars} Stars
💰 ${formatPrice(order.amount)} UZS

Stars отправлены пользователю!
            `.trim());

            // Отправка красивого лога в канал
            await sendLogToChannel(order);

            // Отправка Stars через Fragment API (если настроен)
            await sendStarsToUser(order);
        } else {
            await editMessage(chatId, messageId, `❌ Заказ ${orderId} не найден`);
        }
    }

    else if (action === 'reject') {
        // Отклонение - запрашиваем причину
        await answerCallback(callbackId, '');

        // Добавляем кнопки с причинами
        const keyboard = {
            inline_keyboard: [
                [{ text: '📸 Некорректный скриншот', callback_data: `rejectr_${orderId}_screenshot` }],
                [{ text: '💳 Платёж не найден', callback_data: `rejectr_${orderId}_notfound` }],
                [{ text: '💰 Неверная сумма', callback_data: `rejectr_${orderId}_amount` }],
                [{ text: '🔙 Отмена', callback_data: `cancel_${orderId}` }]
            ]
        };

        await editMessage(chatId, messageId, `
<b>❌ Отклонение заказа ${orderId}</b>

Выберите причину отклонения:
        `.trim(), keyboard);
    }

    else if (action === 'rejectr') {
        // Финальное отклонение с причиной
        const [, orderIdPart, reasonCode] = data.split('_');

        const reasons = {
            'screenshot': 'Некорректный или нечитаемый скриншот',
            'notfound': 'Платёж не найден в системе',
            'amount': 'Сумма платежа не совпадает'
        };

        const reason = reasons[reasonCode] || 'Отклонено администратором';
        const order = ordersCache.find(o => o.orderId === orderIdPart);

        if (order) {
            order.status = 'rejected';
            order.rejectReason = reason;

            // Уведомляем пользователя
            await notifyUser(order.username, 'rejected', orderIdPart, order.stars, reason);

            await editMessage(chatId, messageId, `
<b>❌ ЗАКАЗ ОТКЛОНЁН</b>

📦 Номер: <code>${orderIdPart}</code>
👤 @${order.username}
📝 Причина: ${reason}
            `.trim());
        }

        await answerCallback(callbackId, '✅ Заказ отклонён');
    }

    else if (action === 'cancel') {
        // Отмена действия - возвращаем кнопки
        const order = ordersCache.find(o => o.orderId === orderId);

        if (order) {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Подтвердить', callback_data: `confirm_${orderId}` },
                        { text: '❌ Отклонить', callback_data: `reject_${orderId}` }
                    ]
                ]
            };

            await editMessage(chatId, messageId, `
<b>📦 Заказ ${orderId}</b>

👤 @${order.username}
⭐ ${order.stars} Stars
💰 ${formatPrice(order.amount)} UZS

Выберите действие:
            `.trim(), keyboard);
        }

        await answerCallback(callbackId, '');
    }

    else if (action === 'details') {
        // Показать детали заказа
        const order = ordersCache.find(o => o.orderId === orderId);

        if (order) {
            await answerCallback(callbackId, `
Заказ: ${orderId}
User: @${order.username}
Stars: ${order.stars}
Сумма: ${formatPrice(order.amount)} UZS
Дата: ${new Date(order.createdAt).toLocaleString('ru-RU')}
            `.trim(), true);
        } else {
            await answerCallback(callbackId, '❌ Заказ не найден', true);
        }
    }
}

/**
 * Отправка Stars через Fragment API
 */
async function sendStarsToUser(order) {
    const FRAGMENT_API_KEY = process.env.FRAGMENT_API_KEY;

    if (!FRAGMENT_API_KEY) {
        console.log('Fragment API не настроен - Stars не отправлены автоматически');
        return { success: false, simulated: true };
    }

    try {
        const response = await fetch('https://fragment.com/api/v1/stars/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FRAGMENT_API_KEY}`
            },
            body: JSON.stringify({
                recipient: order.username.replace('@', ''),
                amount: order.stars
            })
        });

        const result = await response.json();
        console.log('Fragment API результат:', result);
        return { success: response.ok, data: result };
    } catch (error) {
        console.error('Ошибка Fragment API:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Обработка текстовых сообщений (проверка номера заказа)
 */
async function handleText(chatId, text, username) {
    // Проверяем номер заказа
    const orderMatch = text.match(/ORD-[A-Z0-9]{6}/i);

    if (orderMatch) {
        const orderId = orderMatch[0].toUpperCase();
        const order = ordersCache.find(o => o.orderId === orderId);

        if (order) {
            const statusEmoji = {
                'pending': '⏳',
                'confirmed': '✅',
                'rejected': '❌'
            };

            const statusText = {
                'pending': 'Ожидает подтверждения',
                'confirmed': 'Подтверждён - Stars отправлены',
                'rejected': 'Отклонён'
            };

            await sendMessage(chatId, `
<b>📦 Информация о заказе</b>

Номер: <code>${orderId}</code>
Статус: ${statusEmoji[order.status]} ${statusText[order.status]}
Stars: ${order.stars}
Дата: ${new Date(order.createdAt).toLocaleString('ru-RU')}
${order.status === 'rejected' && order.rejectReason ? `\nПричина: ${order.rejectReason}` : ''}
            `.trim());
        } else {
            await sendMessage(chatId, `❌ Заказ <code>${orderId}</code> не найден.\n\nПроверьте правильность номера.`);
        }
        return;
    }

    // Обычное сообщение
    await sendMessage(chatId, `
Привет${username ? `, @${username}` : ''}! 👋

Чтобы проверить статус заказа, отправьте его номер.
Пример: <code>ORD-ABC123</code>

Используйте /help для справки.
    `.trim());
}

/**
 * Основной обработчик Netlify Function
 */
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const update = JSON.parse(event.body);
        console.log('📥 Telegram update:', JSON.stringify(update, null, 2));

        // Обработка сообщений
        if (update.message) {
            const msg = update.message;
            const chatId = msg.chat.id;
            const text = msg.text || '';
            const username = msg.from?.username;

            // Команды
            if (text.startsWith('/start')) {
                await handleStart(chatId, username);
            } else if (text.startsWith('/help')) {
                await handleHelp(chatId);
            } else if (text.startsWith('/orders') || text.startsWith('/pending')) {
                await handleOrders(chatId);
            } else if (text === ADMIN_SECRET) {
                // Секретная команда для получения chat_id
                await sendMessage(chatId, `
<b>🔐 Ваш Chat ID:</b>
<code>${chatId}</code>

Добавьте это значение в переменную TELEGRAM_ADMIN_CHAT_ID
                `.trim());
            } else {
                await handleText(chatId, text, username);
            }
        }

        // Обработка callback кнопок
        if (update.callback_query) {
            await handleCallback(update.callback_query);
        }

        return { statusCode: 200, body: JSON.stringify({ ok: true }) };

    } catch (error) {
        console.error('❌ Ошибка webhook:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

/**
 * Экспорт функций для использования другими модулями
 */
module.exports.notifyAdminNewOrder = notifyAdminNewOrder;
module.exports.notifyUser = notifyUser;
module.exports.ordersCache = ordersCache;
