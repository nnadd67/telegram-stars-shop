/* ==================== КОНФИГУРАЦИЯ ==================== */

const CONFIG = {
    API_BASE_URL: '/.netlify/functions',
    PRICES_FILE: '/config/prices.json',
    BANKS_FILE: '/config/banks.json',
    SETTINGS_FILE: '/config/settings.json',
};

const STORAGE_KEYS = {
    CURRENT_ORDER: 'currentOrder',
    USER_ORDERS: 'userOrders',
};

/* ==================== ИНИЦИАЛИЗАЦИЯ ==================== */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('?? Инициализация приложения...');
    
    await loadPrices();
    await loadBanks();
    setupEventListeners();
    restoreOrderState();
    
    console.log('? Приложение инициализировано');
});

/* ==================== ЗАГРУЗКА ДАННЫХ ==================== */

/**
 * Загружает пакеты Stars и выводит их на странице
 */
async function loadPrices() {
    try {
        const response = await fetch(CONFIG.PRICES_FILE);
        const data = await response.json();
        renderPackages(data.packages);
    } catch (error) {
        console.error('? Ошибка при загрузке цен:', error);
        showNotification('Ошибка при загрузке пакетов', 'error');
    }
}

/**
 * Загружает методы оплаты и заполняет select
 */
async function loadBanks() {
    try {
        const response = await fetch(CONFIG.BANKS_FILE);
        const data = await response.json();
        renderPaymentMethods(data.payment_methods);
    } catch (error) {
        console.error('? Ошибка при загрузке банков:', error);
        showNotification('Ошибка при загрузке методов оплаты', 'error');
    }
}

/**
 * Отрисовывает пакеты Stars на странице
 */
function renderPackages(packages) {
    const packagesGrid = document.getElementById('packagesGrid');
    packagesGrid.innerHTML = '';

    packages.forEach(pkg => {
        const card = document.createElement('div');
        card.className = 'package-card';
        card.dataset.packageId = pkg.id;
        card.dataset.stars = pkg.stars;
        card.dataset.price = pkg.uzs_price;

        let badgeHTML = '';
        if (pkg.discount_percent > 0) {
            badgeHTML = `<div class="package-badge">-${pkg.discount_percent}%</div>`;
        }
        if (pkg.popular) {
            badgeHTML = `<div class="package-badge package-popular">ТОП</div>`;
        }

        card.innerHTML = `
            ${badgeHTML}
            <div class="package-stars">? ${pkg.stars}</div>
            <div class="package-description">${pkg.description}</div>
            <div class="package-price">${formatNumber(pkg.uzs_price)} сум</div>
            <button type="button" class="package-button">Выбрать</button>
        `;

        card.addEventListener('click', () => selectPackage(pkg));
        packagesGrid.appendChild(card);
    });
}

/**
 * Отрисовывает методы оплаты в select
 */
function renderPaymentMethods(methods) {
    const select = document.getElementById('paymentMethod');
    
    methods.forEach(method => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = method.name;
        select.appendChild(option);
    });
}

/* ==================== РАБОТА С ПАКЕТАМИ ==================== */

/**
 * Выбирает пакет Stars
 */
function selectPackage(pkg) {
    // Убираем класс selected со всех карт
    document.querySelectorAll('.package-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Добавляем класс selected к выбранной карте
    const selectedCard = document.querySelector(`[data-package-id="${pkg.id}"]`);
    selectedCard?.classList.add('selected');

    // Заполняем скрытые поля
    document.getElementById('selectedPackage').value = pkg.id;
    document.getElementById('selectedStars').value = pkg.stars;
    document.getElementById('selectedPrice').value = pkg.uzs_price;

    // Обновляем информацию о пакете
    document.getElementById('selectedPackageInfo').textContent = 
        `${pkg.stars} Stars - ${formatNumber(pkg.uzs_price)} сум`;

    // Обновляем поля формы
    document.getElementById('starsAmount').value = pkg.stars;
    document.getElementById('paymentAmount').value = formatNumber(pkg.uzs_price);

    // Генерируем номер заказа
    generateOrderNumber();

    // Прокручиваем к форме
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
}

/* ==================== РАБОТА С НОМЕРОМ ЗАКАЗА ==================== */

/**
 * Генерирует уникальный номер заказа
 */
function generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderNumber = `ORDER-${timestamp}-${random}`;
    
    document.getElementById('orderNumber').textContent = orderNumber;
    
    // Сохраняем в localStorage
    const currentOrder = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_ORDER) || '{}');
    currentOrder.orderNumber = orderNumber;
    localStorage.setItem(STORAGE_KEYS.CURRENT_ORDER, JSON.stringify(currentOrder));

    return orderNumber;
}

/**
 * Копирует номер заказа в буфер обмена
 */
function copyOrderNumber() {
    const orderNumber = document.getElementById('orderNumber').textContent;
    if (orderNumber === 'Будет сгенерирован') return;

    navigator.clipboard.writeText(orderNumber).then(() => {
        showNotification('Номер заказа скопирован! ?', 'success');
    }).catch(() => {
        showNotification('Ошибка при копировании', 'error');
    });
}

/* ==================== РАБОТА С СПОСОБОМ ОПЛАТЫ ==================== */

/**
 * Показывает информацию о выбранном методе оплаты
 */
async function updatePaymentInfo(paymentMethodId) {
    if (!paymentMethodId) {
        document.getElementById('paymentInfoGroup').style.display = 'none';
        return;
    }

    try {
        const response = await fetch(CONFIG.BANKS_FILE);
        const data = await response.json();
        const method = data.payment_methods.find(m => m.id === paymentMethodId);

        if (method) {
            displayPaymentCard(method);
            document.getElementById('paymentInfoGroup').style.display = 'block';
        }
    } catch (error) {
        console.error('? Ошибка при загрузке информации о платеже:', error);
    }
}

/**
 * Отображает карточку платежного метода
 */
function displayPaymentCard(method) {
    const cardInfo = document.getElementById('paymentCardInfo');
    
    let paymentDetails = `
        <h4>?? ${method.name}</h4>
    `;

    if (method.card_number) {
        paymentDetails += `
            <div class="payment-detail">
                <label>Номер карты:</label>
                <span>${method.card_number}</span>
            </div>
            <div class="payment-detail">
                <label>Банк:</label>
                <span>${method.bank_name}</span>
            </div>
            <div class="payment-detail">
                <label>Владелец:</label>
                <span>${method.cardholder}</span>
            </div>
        `;
    }

    if (method.phone_number) {
        paymentDetails += `
            <div class="payment-detail">
                <label>Номер телефона:</label>
                <span>${method.phone_number}</span>
            </div>
        `;
    }

    if (method.commission > 0) {
        paymentDetails += `
            <div class="payment-detail">
                <label>Комиссия:</label>
                <span>${method.commission}%</span>
            </div>
        `;
    }

    paymentDetails += `
        <div class="payment-instruction">
            ?? ${method.instruction}
        </div>
    `;

    cardInfo.innerHTML = paymentDetails;
}

/* ==================== РАБОТА С ЗАГРУЗКОЙ ФАЙЛОВ ==================== */

/**
 * Настраивает загрузку файлов
 */
function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const screenshotInput = document.getElementById('screenshotInput');
    const uploadButton = uploadArea.querySelector('.upload-button');

    // Клик по кнопке загрузки
    uploadButton.addEventListener('click', (e) => {
        e.preventDefault();
        screenshotInput.click();
    });

    // Выбор файла
    screenshotInput.addEventListener('change', handleFileSelect);

    // Drag and Drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);

    // Удаление изображения
    document.getElementById('removeImage').addEventListener('click', (e) => {
        e.preventDefault();
        screenshotInput.value = '';
        document.getElementById('uploadPreview').style.display = 'none';
        uploadArea.style.display = 'block';
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        document.getElementById('screenshotInput').files = files;
        handleFileSelect({ target: { files } });
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    
    if (!file) return;

    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Неверный формат файла. Допустимы: JPG, PNG, WebP', 'error');
        e.target.value = '';
        return;
    }

    // Проверка размера (10 МБ)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('Размер файла превышает 10 МБ', 'error');
        e.target.value = '';
        return;
    }

    // Показываем превью
    const reader = new FileReader();
    reader.onload = (event) => {
        const previewImage = document.getElementById('previewImage');
        previewImage.src = event.target.result;
        
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('uploadPreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

/* ==================== РАБОТА С FAQ ==================== */

/**
 * Настраивает FAQ аккордеон
 */
function setupFAQ() {
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', () => {
            const faqItem = button.parentElement;
            const isActive = button.classList.contains('active');

            // Закрываем все
            document.querySelectorAll('.faq-question').forEach(btn => {
                btn.classList.remove('active');
                btn.nextElementSibling.classList.remove('show');
            });

            // Открываем текущий
            if (!isActive) {
                button.classList.add('active');
                button.nextElementSibling.classList.add('show');
            }
        });
    });
}

/* ==================== РАБОТА С ФОРМОЙ ==================== */

/**
 * Настраивает обработчики формы
 */
function setupFormHandlers() {
    const orderForm = document.getElementById('orderForm');
    const paymentMethod = document.getElementById('paymentMethod');
    const copyButton = document.getElementById('copyOrderNumber');

    paymentMethod.addEventListener('change', (e) => {
        updatePaymentInfo(e.target.value);
    });

    copyButton.addEventListener('click', copyOrderNumber);

    orderForm.addEventListener('submit', handleFormSubmit);
}

/**
 * Обработчик отправки формы
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    // Валидация
    if (!validateForm()) {
        return;
    }

    // Получаем данные формы
    const formData = new FormData(document.getElementById('orderForm'));
    const screenshot = formData.get('screenshot');

    // Создаем объект заказа
    const orderData = {
        orderNumber: document.getElementById('orderNumber').textContent,
        telegramUsername: formData.get('telegramUsername'),
        stars: formData.get('stars'),
        uzs_price: formData.get('price'),
        paymentMethod: formData.get('paymentMethod'),
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    try {
        // Показываем загрузку
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = true;
        document.getElementById('loadingSpinner').style.display = 'inline-block';

        // Отправляем заказ на сервер
        const response = await fetch(`${CONFIG.API_BASE_URL}/process-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...orderData,
                // Скриншот кодируем в base64
                screenshot: await fileToBase64(screenshot)
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showOrderSuccess(orderData);
            localStorage.setItem(STORAGE_KEYS.CURRENT_ORDER, JSON.stringify(orderData));
            
            // Сбрасываем форму
            document.getElementById('orderForm').reset();
            document.getElementById('uploadPreview').style.display = 'none';
            document.getElementById('uploadArea').style.display = 'block';
            document.getElementById('selectedPackageInfo').textContent = 'Выберите пакет выше';
        } else {
            showNotification(result.message || 'Ошибка при обработке заказа', 'error');
        }
    } catch (error) {
        console.error('? Ошибка при отправке заказа:', error);
        showNotification('Ошибка при отправке заказа. Попробуйте позже.', 'error');
    } finally {
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = false;
        document.getElementById('loadingSpinner').style.display = 'none';
    }
}

/**
 * Валидирует форму перед отправкой
 */
function validateForm() {
    const username = document.getElementById('telegramUsername').value.trim();
    const packageId = document.getElementById('selectedPackage').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const screenshot = document.getElementById('screenshotInput').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    // Проверяем Telegram username
    if (!username || !username.match(/^[a-zA-Z0-9_]{5,32}$/)) {
        showNotification('Некорректный Telegram username. Должен быть от 5 до 32 символов', 'error');
        return false;
    }

    // Проверяем выбор пакета
    if (!packageId) {
        showNotification('Выберите пакет Stars', 'error');
        return false;
    }

    // Проверяем выбор способа оплаты
    if (!paymentMethod) {
        showNotification('Выберите способ оплаты', 'error');
        return false;
    }

    // Проверяем скриншот
    if (!screenshot) {
        showNotification('Загрузите скриншот оплаты', 'error');
        return false;
    }

    // Проверяем согласие с условиями
    if (!agreeTerms) {
        showNotification('Согласитесь с условиями и положениями', 'error');
        return false;
    }

    return true;
}

/**
 * Показывает сообщение об успешном заказе
 */
function showOrderSuccess(orderData) {
    const statusCard = document.getElementById('statusCard');
    
    statusCard.className = 'status-card pending';
    statusCard.innerHTML = `
        <div class="status-header">
            <div class="status-icon">?</div>
            <div>
                <div class="status-title">Заказ принят!</div>
            </div>
        </div>
        <ul class="status-details">
            <li>
                <span class="status-label">Номер заказа:</span>
                <strong>${orderData.orderNumber}</strong>
            </li>
            <li>
                <span class="status-label">Stars:</span>
                <strong>${orderData.stars}</strong>
            </li>
            <li>
                <span class="status-label">Сумма:</span>
                <strong>${formatNumber(orderData.uzs_price)} сум</strong>
            </li>
            <li>
                <span class="status-label">Статус:</span>
                <strong style="color: #ff9800;">? Ожидание подтверждения</strong>
            </li>
            <li>
                <span class="status-label">Время:</span>
                <strong>${new Date(orderData.timestamp).toLocaleString('ru-RU')}</strong>
            </li>
        </ul>
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 13px; color: #666;">
            ? Админ получил уведомление о вашем заказе<br>
            ? Вы получите уведомление в Telegram при обработке<br>
            ? Stars придут в течение 5-15 минут после подтверждения
        </div>
    `;

    document.getElementById('orderStatus').style.display = 'block';
    document.getElementById('orderStatus').scrollIntoView({ behavior: 'smooth' });

    showNotification('Заказ успешно отправлен! ?', 'success');
}

/* ==================== УТИЛИТЫ ==================== */

/**
 * Форматирует число с разделителем тысяч
 */
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

/**
 * Конвертирует файл в Base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * Показывает уведомление
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
        notification.classList.add('removing');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);

    return notification;
}

/**
 * Восстанавливает состояние заказа из localStorage
 */
function restoreOrderState() {
    const currentOrder = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_ORDER) || '{}');
    
    if (currentOrder.orderNumber) {
        document.getElementById('orderNumber').textContent = currentOrder.orderNumber;
    }
}

/* ==================== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ ==================== */

function setupEventListeners() {
    setupFileUpload();
    setupFAQ();
    setupFormHandlers();
}

console.log('? script.js загружен успешно');
