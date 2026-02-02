// netlify/functions/telegram-webhook.js
// Telegram бот для управления заказами и ценами

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID;
const ADMIN_SECRET = process.env.ADMIN_SECRET_COMMAND || '/getadmin111';

// Кеш цен (в памяти)
let pricesCache = [
    { id: 1, stars: 50, price: 14000, desc: "Test Pack" },
    { id: 2, stars: 100, price: 27000, desc: "Starter Pack" },
    { id: 3, stars: 250, price: 65000, desc: "Popular Choice", popular: true },
    { id: 4, stars: 500, price: 125000, desc: "Sponsor Pack" },
    { id: 5, stars: 1000, price: 250000, desc: "Ultimate", popular: true }
];

// ... (остальной код бота)

/**
 * Команда /setprice [ID] [Цена UZS]
 */
async function handleSetPrice(chatId, text) {
    if (String(chatId) !== String(ADMIN_CHAT_ID)) return;

    const parts = text.split(' ');
    if (parts.length !== 3) {
        return sendMessage(chatId, '❌ Использование: /setprice [ID] [Цена]\nПример: /setprice 1 15000');
    }

    const id = parseInt(parts[1]);
    const cleanPrice = parts[2].replace(/[.,]/g, ''); // Убираем точки и запятые
    const price = parseInt(cleanPrice);

    const pkg = pricesCache.find(p => p.id === id);

    if (pkg) {
        pkg.price = price;
        await sendMessage(chatId, `✅ Цена для пакета <b>${pkg.stars} Stars</b> обновлена на <b>${new Intl.NumberFormat('ru-RU').format(price)} UZS</b>`);
    } else {
        await sendMessage(chatId, '❌ Пакет с таким ID не найден (ID от 1 до 5)');
    }
}

/**
 * Команда /getprices
 */
async function handleGetPrices(chatId) {
    if (String(chatId) !== String(ADMIN_CHAT_ID)) return;

    let msg = '<b>💰 Текущие цены:</b>\n\n';
    pricesCache.forEach(p => {
        msg += `🆔 <b>${p.id}</b> | ⭐ ${p.stars} = ${new Intl.NumberFormat('ru-RU').format(p.price)} UZS\n`;
    });

    await sendMessage(chatId, msg);
}

// ... (функции process update)

// Добавляем обработчик в main handler:
/*
            if (text.startsWith('/setprice')) {
                await handleSetPrice(chatId, text);
            } else if (text.startsWith('/getprices')) {
                await handleGetPrices(chatId);
            }
*/
