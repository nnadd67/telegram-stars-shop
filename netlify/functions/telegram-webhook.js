// netlify/functions/telegram-webhook.js
// Полный функционал: Бот + Управление ценами + Логи + API

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID;

// === ХРАНИЛИЩЕ ДАННЫХ (In-Memory) ===
// Внимание: Сбрасывается при деплое. Для продакшена нужна БД!
let pricesCache = [
    { id: 1, stars: 50, price: 14000, desc: "Test Pack" },
    { id: 2, stars: 100, price: 27000, desc: "Starter Pack" },
    { id: 7, stars: 200, price: 51000, desc: "Выгодный набор" },
    { id: 3, stars: 250, price: 65000, desc: "Popular Choice", popular: true },
    { id: 8, stars: 300, price: 73000, desc: "Золотая середина" },
    { id: 4, stars: 500, price: 125000, desc: "Sponsor Pack" },
    { id: 5, stars: 1000, price: 250000, desc: "Ultimate", popular: true },
    { id: 6, stars: 3000, price: 730000, desc: "Максимальная выгода", popular: true }
];

let ordersCache = [];

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

async function sendMessage(chatId, text, options = {}) {
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...options })
        });
    } catch (e) { console.error('Message Error', e); }
}

async function editMessage(chatId, msgId, text, replyMarkup = null) {
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: msgId,
                text,
                parse_mode: 'HTML',
                reply_markup: replyMarkup
            })
        });
    } catch (e) { console.error('Edit Error', e); }
}

async function answerCallback(id, text, alert = false) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: id, text, show_alert: alert })
    });
}

function formatPrice(p) { return new Intl.NumberFormat('ru-RU').format(p); }
function isAdmin(id) { return String(id) === String(ADMIN_CHAT_ID); }

// === ЛОГИКА АДМИНА (ЦЕНЫ) ===

async function handleSetPrice(chatId, text) {
    if (!isAdmin(chatId)) return;
    const parts = text.split(' ');
    if (parts.length !== 3) return sendMessage(chatId, '❌ Пример: /setprice 1 15000');

    const id = parseInt(parts[1]);
    const price = parseInt(parts[2].replace(/\D/g, ''));
    const pkg = pricesCache.find(p => p.id === id);

    if (pkg) {
        pkg.price = price;
        await sendMessage(chatId, `✅ Цена ${pkg.stars} Stars = <b>${formatPrice(price)} UZS</b>`);
    } else {
        await sendMessage(chatId, '❌ ID не найден');
    }
}

async function handleGetPrices(chatId) {
    if (!isAdmin(chatId)) return;
    let msg = '<b>💰 Прайс-лист:</b>\n\n';
    pricesCache.forEach(p => msg += `🆔 <b>${p.id}</b> | ⭐ ${p.stars} = ${formatPrice(p.price)} UZS\n`);
    await sendMessage(chatId, msg);
}

// === ЛОГИКА ЗАКАЗОВ ===

async function sendLogToChannel(order) {
    if (!LOGS_CHANNEL_ID) return;
    const msg = `
<b>Order ID:</b> #${order.orderId}
<b>Type:</b> stars ⭐
<b>Amount:</b> ${order.stars} звезд 💸
<b>Price:</b> ${formatPrice(order.amount)} 🏷️
<b>Status:</b> ✅ Completed
<b>Time:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}
    `.trim();
    await sendMessage(LOGS_CHANNEL_ID, msg);
}

async function notifyUser(username, status, orderId, stars, reason = '') {
    let msg = '';
    if (status === 'confirmed') {
        msg = `✅ <b>Заказ ${orderId} выполнен!</b>\n\n⭐ Начислено: ${stars} Stars\nСпасибо за покупку!`;
    } else if (status === 'rejected') {
        msg = `❌ <b>Заказ ${orderId} отменён</b>\n\nПричина: ${reason}`;
    }

    if (username) {
        await sendMessage(`@${username.replace('@', '')}`, msg);
    }
}

async function handleCallback(cb) {
    const { message, data, id } = cb;
    const chatId = message.chat.id;

    if (!isAdmin(chatId)) return answerCallback(id, 'Нет доступа', true);

    const [action, orderId] = data.split('_');
    const order = ordersCache.find(o => o.orderId === orderId);

    if (!order) return answerCallback(id, 'Заказ не найден', true);

    if (action === 'confirm') {
        order.status = 'confirmed';
        await editMessage(chatId, message.message_id, `✅ <b>Заказ ${orderId}</b>\n⭐ ${order.stars} Stars\n💰 ${formatPrice(order.amount)} UZS\n\nСтатус: ВЫПОЛНЕН`);
        await sendLogToChannel(order);
        await notifyUser(order.username, 'confirmed', orderId, order.stars);
        await answerCallback(id, '✅ Подтверждено');
    } else if (action === 'reject') {
        // Упрощаем логику отклонения для надежности
        order.status = 'rejected';
        await editMessage(chatId, message.message_id, `❌ <b>Заказ ${orderId}</b>\nStatus: ОТКЛОНЁН`);
        await notifyUser(order.username, 'rejected', orderId, order.stars, 'Отклонено администратором');
        await answerCallback(id, '❌ Отклонено');
    }
}

async function handleStart(chatId) {
    await sendMessage(chatId, `
<b>👋 Привет! Это Stars Shop.</b>

Здесь вы можете купить Telegram Stars.
Просто оформите заказ на сайте, и вы получите уведомление здесь.

<b>Команды:</b>
/help - Помощь
${isAdmin(chatId) ? '/getprices - Управление ценами' : ''}
    `.trim());
}

// === ОБРАБОТЧИК ===

exports.handler = async (event) => {
    // 1. API: Получение цен (GET)
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Разрешить всем
            },
            body: JSON.stringify({ packages: pricesCache })
        };
    }

    // 2. Telegram Webhook (POST)
    if (event.httpMethod === 'POST') {
        try {
            const update = JSON.parse(event.body);

            if (update.message) {
                const { chat, text } = update.message;
                if (!text) return { statusCode: 200, body: 'No text' };

                if (text.startsWith('/start')) await handleStart(chat.id);
                else if (text.startsWith('/setprice')) await handleSetPrice(chat.id, text);
                else if (text === '/getprices') await handleGetPrices(chat.id);
                else if (text === '/id') await sendMessage(chat.id, `ID: <code>${chat.id}</code>`);
            }

            if (update.callback_query) {
                await handleCallback(update.callback_query);
            }

            return { statusCode: 200, body: 'OK' };
        } catch (error) {
            console.error(error);
            return { statusCode: 500, body: error.message };
        }
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
};

// Экспорт для process-order.js
module.exports.pricesCache = pricesCache;
module.exports.ordersCache = ordersCache;
module.exports.notifyAdminNewOrder = async function (order) { // Функция заглушка, реальную логику перенести если надо, или использовать process-order
    if (!ADMIN_CHAT_ID) return;
    const kb = { inline_keyboard: [[{ text: '✅', callback_data: `confirm_${order.orderId}` }, { text: '❌', callback_data: `reject_${order.orderId}` }]] };
    await sendMessage(ADMIN_CHAT_ID, `🆕 <b>Заказ ${order.orderId}</b>\n⭐ ${order.stars}\n💰 ${formatPrice(order.amount)}`, { reply_markup: kb });
};
