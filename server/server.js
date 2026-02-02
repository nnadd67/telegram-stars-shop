const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Логирование запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API Endpoints
// Эмуляция Netlify Functions для локальной разработки

// Получение конфигурации
app.get('/config/prices.json', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, '../config/prices.json'), 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Ошибка чтения конфигурации' });
    }
});

app.get('/config/banks.json', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, '../config/banks.json'), 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Ошибка чтения конфигурации' });
    }
});

// Обработка заказов (эмуляция)
app.post('/.netlify/functions/process-order', async (req, res) => {
    console.log('📝 Получен заказ:', req.body);

    // Эмуляция задержки
    setTimeout(() => {
        res.json({
            success: true,
            orderId: 'DEV-' + Math.floor(Math.random() * 100000),
            message: 'Заказ успешно создан (DEV режим)'
        });
    }, 1000);
});

// Админ-панель (эмуляция)
app.post('/.netlify/functions/verify-admin', (req, res) => {
    const { password } = req.body;
    if (password === (process.env.ADMIN_PASSWORD || 'admin')) {
        res.json({ success: true, token: 'dev-token' });
    } else {
        res.status(401).json({ error: 'Неверный пароль' });
    }
});

app.get('/.netlify/functions/get-orders', (req, res) => {
    // Возвращаем демо-данные
    res.json({
        success: true,
        orders: [
            {
                orderNumber: 'DEV-123456',
                telegramUsername: 'demo_user',
                stars: 100,
                amount: 25000,
                status: 'pending',
                createdAt: new Date().toISOString()
            }
        ]
    });
});

// Любой другой запрос отправляет index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
🚀 Сервер запущен!
📡 URL: http://localhost:${PORT}
📂 Статика: ${path.join(__dirname, '../public')}
    `);
});
