// netlify/functions/get-orders.js
// Получение списка заказов для админ-панели

/**
 * Демо-данные заказов (в реальном проекте - база данных)
 */
function getDemoOrders() {
    return [
        {
            orderId: 'ORD-ABC123',
            telegramUsername: 'user1',
            stars: 100,
            amount: 27000,
            paymentMethod: 'Humo',
            status: 'pending',
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        {
            orderId: 'ORD-DEF456',
            telegramUsername: 'user2',
            stars: 250,
            amount: 65000,
            paymentMethod: 'Humo',
            status: 'completed',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        },
        {
            orderId: 'ORD-GHI789',
            telegramUsername: 'user3',
            stars: 500,
            amount: 125000,
            paymentMethod: 'Humo',
            status: 'rejected',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
        }
    ];
}

/**
 * Фильтрация заказов
 */
function filterOrders(orders, filters) {
    let result = [...orders];

    // Фильтр по статусу
    if (filters.status && filters.status !== 'all') {
        result = result.filter(o => o.status === filters.status);
    }

    // Фильтр по дате
    if (filters.date) {
        const filterDate = new Date(filters.date).toDateString();
        result = result.filter(o => new Date(o.createdAt).toDateString() === filterDate);
    }

    // Поиск
    if (filters.search) {
        const search = filters.search.toLowerCase();
        result = result.filter(o =>
            o.orderId.toLowerCase().includes(search) ||
            o.telegramUsername.toLowerCase().includes(search)
        );
    }

    return result;
}

/**
 * Сортировка заказов
 */
function sortOrders(orders, sortBy) {
    const sorted = [...orders];

    switch (sortBy) {
        case 'newest':
            return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        case 'oldest':
            return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        case 'amount_high':
            return sorted.sort((a, b) => b.amount - a.amount);
        case 'amount_low':
            return sorted.sort((a, b) => a.amount - b.amount);
        default:
            return sorted;
    }
}

/**
 * Статистика
 */
function getStats(orders) {
    return {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        completed: orders.filter(o => o.status === 'completed').length,
        rejected: orders.filter(o => o.status === 'rejected').length,
        totalRevenue: orders
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + o.amount, 0),
        totalStars: orders
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + o.stars, 0)
    };
}

/**
 * Основная функция Netlify
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Проверка авторизации
        const authHeader = event.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        if (token !== process.env.ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Неавторизованный доступ' })
            };
        }

        // Параметры запроса
        const params = event.queryStringParameters || {};
        const filters = {
            status: params.status,
            date: params.date,
            search: params.search
        };
        const sortBy = params.sort || 'newest';
        const page = parseInt(params.page) || 1;
        const limit = parseInt(params.limit) || 20;

        // Получаем заказы
        let orders = getDemoOrders();

        // Фильтруем
        orders = filterOrders(orders, filters);

        // Сортируем
        orders = sortOrders(orders, sortBy);

        // Статистика
        const stats = getStats(getDemoOrders());

        // Пагинация
        const totalPages = Math.ceil(orders.length / limit);
        const offset = (page - 1) * limit;
        const paginatedOrders = orders.slice(offset, offset + limit);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                orders: paginatedOrders,
                pagination: {
                    page,
                    limit,
                    total: orders.length,
                    totalPages
                },
                stats
            })
        };

    } catch (error) {
        console.error('Ошибка получения заказов:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Внутренняя ошибка сервера' })
        };
    }
};
