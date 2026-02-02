/* ==================== КОНФИГУРАЦИЯ ==================== */

const CONFIG = {
    API_BASE_URL: '/.netlify/functions',
    ADMIN_USERNAME: 'admin',
    ORDERS_STORAGE_KEY: 'orders',
    AUTH_TOKEN_KEY: 'adminAuthToken'
};

let currentOrders = [];
let currentOrder = null;

/* ==================== ИНИЦИАЛИЗАЦИЯ ==================== */

document.addEventListener('DOMContentLoaded', () => {
    console.log('⚡ Админ-панель загружается...');
    
    const authToken = localStorage.getItem(CONFIG.AUTH_TOKEN_KEY);
    if (authToken) {
        // Проверяем действительность токена
        if (isTokenValid(authToken)) {
            showAdminPanel();
            loadOrders();
        } else {
            localStorage.removeItem(CONFIG.AUTH_TOKEN_KEY);
            showLoginForm();
        }
    } else {
        showLoginForm();
    }

    setupEventListeners();
});

/* ==================== АВТОРИЗАЦИЯ ==================== */

const ADMIN_SECRET = 'getadmin111'; // Секрет для входа

function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('refreshBtn').addEventListener('click', loadOrders);
    document.getElementById('closeModal').addEventListener('click', closeOrderModal);
    document.getElementById('filterStatus').addEventListener('change', filterOrders);
    document.getElementById('filterSearch').addEventListener('input', filterOrders);
    
    // Закрытие модалки по клику вне
    document.getElementById('orderModal').addEventListener('click', (e) => {
        if (e.target.id === 'orderModal') {
            closeOrderModal();
        }
    });
}

/**
 * Обработка входа в админку
 */
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    errorMessage.classList.remove('show');

    // Проверка секретного кода
    if (!sessionStorage.getItem('adminSecretVerified')) {
        // Первый шаг - проверка секретного кода
        if (username === ADMIN_SECRET) {
            sessionStorage.setItem('adminSecretVerified', 'true');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            errorMessage.textContent = '✅ Секретный код верный! Теперь введите пароль';
            errorMessage.classList.add('show');
            errorMessage.style.background = 'rgba(76, 175, 80, 0.1)';
            errorMessage.style.color = '#2e7d32';
            document.getElementById('username').placeholder = 'admin';
            return;
        } else {
            errorMessage.textContent = '❌ Неверный секретный код';
            errorMessage.classList.add('show');
            return;
        }
    }

    // Второй этап - проверка логина/пароля
    if (username !== CONFIG.ADMIN_USERNAME) {
        errorMessage.textContent = '❌ Неверный логин администратора';
        errorMessage.classList.add('show');
        return;
    }

    // Проверка пароля
    const correctPassword = 'safiyevT7';
    if (password !== correctPassword) {
        errorMessage.textContent = '❌ Неверный пароль';
        errorMessage.classList.add('show');
        return;
    }

    // Успешная авторизация
    const token = generateToken(username);
    localStorage.setItem(CONFIG.AUTH_TOKEN_KEY, token);
    
    sessionStorage.removeItem('adminSecretVerified');
    errorMessage.classList.remove('show');
    document.getElementById('loginForm').reset();
    showAdminPanel();
    loadOrders();
}

/**
 * Обработка выхода из админки
 */
function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem(CONFIG.AUTH_TOKEN_KEY);
        sessionStorage.removeItem('adminSecretVerified');
        showLoginForm();
    }
}

/**
 * Показать форму входа
 */
function showLoginForm() {
    sessionStorage.removeItem('adminSecretVerified');
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('username').placeholder = '/getadmin111';
    document.getElementById('username').focus();
}

/**
 * Показать админ-панель
 */
function showAdminPanel() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
}

/**
 * Генерация токена авторизации
 */
function generateToken(username) {
    const timestamp = Date.now();
    const hash = btoa(`${username}:${timestamp}`);
    return hash;
}

/**
 * Проверка действительности токена
 */
function isTokenValid(token) {
    try {
        const decoded = atob(token);
        const [username] = decoded.split(':');
        return username === CONFIG.ADMIN_USERNAME;
    } catch {
        return false;
    }
}

/**
 * Валидация пароля (для расширения функционала)
 */
function validatePassword(password) {
    // Реализация для внешнего хранения пароля
    const correctPassword = localStorage.getItem('adminPassword') || process.env.ADMIN_PASSWORD;
    return password === correctPassword;
}

/* ==================== РАБОТА С ЗАКАЗАМИ ==================== */

/**
 * Загрузка заказов с сервера
 */
async function loadOrders() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/get-orders`);
        const result = await response.json();

        if (result.success && result.orders) {
            currentOrders = result.orders;
        } else {
            // Fallback на локальные данные
            currentOrders = JSON.parse(localStorage.getItem(CONFIG.ORDERS_STORAGE_KEY) || '[]');
        }

        updateStats();
        displayOrders(currentOrders);
        filterOrders();
    } catch (error) {
        console.error('❌ Ошибка при загрузке заказов:', error);
        // Отображаем локальные данные
        currentOrders = JSON.parse(localStorage.getItem(CONFIG.ORDERS_STORAGE_KEY) || '[]');
        updateStats();
        displayOrders(currentOrders);
    }
}

/**
 * Обновление статистики
 */
function updateStats() {
    const total = currentOrders.length;
    const pending = currentOrders.filter(o => o.status === 'pending').length;
    const confirmed = currentOrders.filter(o => o.status === 'confirmed').length;
    const revenue = currentOrders
        .filter(o => o.status === 'confirmed')
        .reduce((sum, o) => sum + parseInt(o.uzs_price || 0), 0);

    document.getElementById('totalOrders').textContent = total;
    document.getElementById('pendingOrders').textContent = pending;
    document.getElementById('confirmedOrders').textContent = confirmed;
    document.getElementById('totalRevenue').textContent = formatNumber(revenue) + ' UZS';
}

/**
 * Отображение заказов в таблице
 */
function displayOrders(orders) {
    const tbody = document.getElementById('ordersList');
    const emptyState = document.getElementById('emptyState');

    if (orders.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>
                <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; font-size: 12px;">
                    ${order.orderNumber}
                </code>
            </td>
            <td>@${order.telegramUsername}</td>
            <td>⭐ ${order.stars}</td>
            <td>${formatNumber(order.uzs_price)} UZS</td>
            <td>${order.paymentMethod}</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${getStatusText(order.status)}
                </span>
            </td>
            <td style="font-size: 12px;">
                ${new Date(order.timestamp).toLocaleString('ru-RU')}
            </td>
            <td>
                <div class="actions">
                    <button class="btn btn-view" onclick="viewOrder('${order.orderNumber}')">Просмотр</button>
                    ${order.status === 'pending' ? `
                        <button class="btn btn-confirm" onclick="confirmOrder('${order.orderNumber}')">✅</button>
                        <button class="btn btn-reject" onclick="rejectOrder('${order.orderNumber}')">❌</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Фильтрация и поиск заказов
 */
function filterOrders() {
    const status = document.getElementById('filterStatus').value;
    const search = document.getElementById('filterSearch').value.toLowerCase();

    let filtered = currentOrders;

    if (status) {
        filtered = filtered.filter(o => o.status === status);
    }

    if (search) {
        filtered = filtered.filter(o => 
            o.telegramUsername.toLowerCase().includes(search) ||
            o.orderNumber.toLowerCase().includes(search)
        );
    }

    displayOrders(filtered);
}

/* ==================== РАБОТА С КОНКРЕТНЫМ ЗАКАЗОМ ==================== */

/**
 * Открытие модального окна с деталями заказа
 */
function viewOrder(orderNumber) {
    currentOrder = currentOrders.find(o => o.orderNumber === orderNumber);
    
    if (!currentOrder) {
        alert('❌ Заказ не найден');
        return;
    }

    const modal = document.getElementById('orderModal');
    const orderDetails = document.getElementById('orderDetails');
    const screenshotContainer = document.getElementById('screenshotContainer');
    const actionButtons = document.getElementById('actionButtons');

    // Заполняем детали
    orderDetails.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Номер заказа:</span>
            <span class="detail-value">${currentOrder.orderNumber}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Telegram:</span>
            <span class="detail-value">@${currentOrder.telegramUsername}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Stars:</span>
            <span class="detail-value">⭐ ${currentOrder.stars}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Сумма:</span>
            <span class="detail-value">${formatNumber(currentOrder.uzs_price)} UZS</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Способ оплаты:</span>
            <span class="detail-value">${currentOrder.paymentMethod}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Статус:</span>
            <span class="detail-value">
                <span class="status-badge ${currentOrder.status}">
                    ${getStatusText(currentOrder.status)}
                </span>
            </span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Дата:</span>
            <span class="detail-value">${new Date(currentOrder.timestamp).toLocaleString('ru-RU')}</span>
        </div>
    `;

    // Отображаем скриншот если есть
    if (currentOrder.screenshot) {
        screenshotContainer.style.display = 'block';
        document.getElementById('screenshotImage').src = currentOrder.screenshot;
    } else {
        screenshotContainer.style.display = 'none';
    }

    // Кнопки действий
    if (currentOrder.status === 'pending') {
        actionButtons.innerHTML = `
            <button class="confirm" onclick="confirmOrder('${currentOrder.orderNumber}')">✅ Подтвердить</button>
            <button class="reject" onclick="rejectOrder('${currentOrder.orderNumber}')">❌ Отклонить</button>
            <button class="cancel" onclick="closeOrderModal()">Закрыть</button>
        `;
    } else {
        actionButtons.innerHTML = `
            <button class="cancel" onclick="closeOrderModal()" style="margin-left: auto;">Закрыть</button>
        `;
    }

    modal.classList.add('show');
}

/**
 * Подтверждение заказа
 */
async function confirmOrder(orderNumber) {
    if (!confirm('Вы уверены, что хотите подтвердить этот заказ? Stars будут отправлены.')) {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/send-stars`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderNumber,
                telegramUsername: currentOrder.telegramUsername,
                stars: currentOrder.stars
            })
        });

        const result = await response.json();

        if (result.success) {
            // Обновляем статус локально
            const order = currentOrders.find(o => o.orderNumber === orderNumber);
            if (order) {
                order.status = 'confirmed';
                localStorage.setItem(CONFIG.ORDERS_STORAGE_KEY, JSON.stringify(currentOrders));
            }

            alert('✅ Заказ подтвержден и Stars отправлены!');
            closeOrderModal();
            loadOrders();

            // Отправляем уведомление в Telegram
            notifyUserTelegram(currentOrder, 'confirmed');
        } else {
            alert('❌ Ошибка: ' + result.message);
        }
    } catch (error) {
        console.error('❌ Ошибка при подтверждении:', error);
        alert('❌ Ошибка при подтверждении заказа');
    }
}

/**
 * Отклонение заказа
 */
async function rejectOrder(orderNumber) {
    const reason = prompt('Укажите причину отклонения (обязательно):');
    
    if (reason === null) return; // Отмена

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/reject-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderNumber,
                reason
            })
        });

        const result = await response.json();

        if (result.success) {
            // Обновляем статус локально
            const order = currentOrders.find(o => o.orderNumber === orderNumber);
            if (order) {
                order.status = 'rejected';
                order.rejectReason = reason;
                localStorage.setItem(CONFIG.ORDERS_STORAGE_KEY, JSON.stringify(currentOrders));
            }

            alert('✅ Заказ отклонен');
            closeOrderModal();
            loadOrders();

            // Отправляем уведомление в Telegram
            notifyUserTelegram(currentOrder, 'rejected', reason);
        } else {
            alert('❌ Ошибка: ' + result.message);
        }
    } catch (error) {
        console.error('❌ Ошибка при отклонении:', error);
        alert('❌ Ошибка при отклонении заказа');
    }
}

/**
 * Закрытие модального окна
 */
function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('show');
    currentOrder = null;
}

/* ==================== УТИЛИТЫ ==================== */

/**
 * Получение читаемого статуса заказа
 */
function getStatusText(status) {
    const statuses = {
        'pending': '⏳ Ожидает',
        'confirmed': '✅ Подтвержден',
        'rejected': '❌ Отклонен'
    };
    return statuses[status] || status;
}

/**
 * Форматирование числа с разделителями
 */
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

/**
 * Отправка уведомления пользователю в Telegram
 */
async function notifyUserTelegram(order, status, reason = '') {
    try {
        await fetch(`${CONFIG.API_BASE_URL}/notify-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegramUsername: order.telegramUsername,
                status,
                orderNumber: order.orderNumber,
                reason
            })
        });
    } catch (error) {
        console.error('⚠️ Не удалось отправить уведомление:', error);
    }
}

console.log('✅ admin.js успешно загружен');