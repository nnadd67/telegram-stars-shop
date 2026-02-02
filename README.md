# Telegram Stars Shop

Платформа для безопасной продажи Telegram Stars в Узбекистане с оплатой по узбекским картам.

## ?? Особенности

- ? Выбор пакетов Stars (100, 500, 1000, 2000, 5000)
- ? Оплата по узбекским картам (Uzcard, Humo, Click)
- ? Загрузка скриншотов оплаты
- ? Админ-панель с управлением заказами
- ? Telegram бот для уведомлений
- ? Автоматическая отправка Stars
- ? Mobile-first responsive дизайн
- ? Полная безопасность и валидация

## ?? Требования

- Node.js 14+
- npm или yarn
- Аккаунт на Netlify
- Telegram бот (создание через @BotFather)
- Узбекские реквизиты для оплаты

## ?? Установка и настройка

### Шаг 1: Клонирование проекта

```bash
git clone <repository-url> telegram-stars-shop
cd telegram-stars-shop
```

### Шаг 2: Установка зависимостей

```bash
npm install
```

### Шаг 3: Создание файла .env

```bash
cp .env.example .env
```

Отредактируйте `.env` со своими данными:

```env
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_ADMIN_CHAT_ID=123456789
TELEGRAM_WEBHOOK_URL=https://your-domain.netlify.app/.netlify/functions/telegram-webhook

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_strong_password

# Fragment API (опционально)
FRAGMENT_API_KEY=your_key_here

# Site
SITE_URL=https://your-domain.uz
```

### Шаг 4: Настройка конфигурационных файлов

Отредактируйте `config/prices.json` и `config/banks.json` со своими данными:

**config/prices.json:**
- Установите правильный курс обмена (exchange_rate)
- Установите цены для каждого пакета Stars
- Укажите какие пакеты популярные

**config/banks.json:**
- Добавьте номера своих карт для приема платежей
- Укажите имя владельца карты
- Установите комиссии банков

### Шаг 5: Локальное тестирование

```bash
npm run dev
```

Сайт будет доступен по адресу `http://localhost:8888`

Админ-панель: `http://localhost:8888/admin.html`

Вход: `admin` / `your_strong_password`

## ?? Деплой на Netlify

### 1. Создание аккаунта и проекта

- Зарегистрируйтесь на [netlify.com](https://www.netlify.com)
- Создайте новый проект из GitHub репозитория

### 2. Установка переменных окружения

В панели Netlify перейдите в `Settings ? Build & Deploy ? Environment`:

Добавьте все переменные из файла `.env`:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `ADMIN_PASSWORD`
- И другие

### 3. Настройка Telegram бота

Установите webhook для вашего Telegram бота:

```bash
curl "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook?url={YOUR_NETLIFY_URL}/.netlify/functions/telegram-webhook"
```

Где:
- `{YOUR_BOT_TOKEN}` - токен вашего бота
- `{YOUR_NETLIFY_URL}` - URL вашего сайта на Netlify

### 4. Деплой

```bash
npm run deploy
```

Или синхронизируйте через GitHub - Netlify автоматически разворачивает каждый push.

## ?? Безопасность

- ? HTTPS обязателен
- ? Валидация всех входных данных
- ? Защита от XSS атак
- ? Rate limiting на API
- ? Админ-панель защищена паролем
- ? Шифрование чувствительных данных

## ?? Структура проекта

```
telegram-stars-shop/
??? public/
?   ??? index.html           # Главная страница
?   ??? admin.html          # Админ-панель
?   ??? style.css           # Стили
?   ??? script.js           # Frontend логика
?   ??? admin.js            # Админ-панель логика
?
??? netlify/
?   ??? functions/          # Serverless функции
?   ?   ??? process-order.js
?   ?   ??? telegram-webhook.js
?   ?   ??? send-stars.js
?   ?   ??? get-orders.js
?   ?   ??? verify-admin.js
?   ?   ??? reject-order.js
?   ?   ??? notify-user.js
?   ??? netlify.toml       # Конфигурация Netlify
?
??? config/
?   ??? prices.json        # Цены пакетов
?   ??? banks.json         # Информация о банках
?   ??? settings.json      # Общие настройки
?
??? .env.example           # Пример переменных окружения
??? package.json           # Зависимости проекта
??? README.md             # Этот файл
```

## ??? API Endpoints

### Для клиентов

**POST** `/.netlify/functions/process-order`
- Создает новый заказ
- Параметры: `orderNumber`, `telegramUsername`, `stars`, `uzs_price`, `paymentMethod`, `screenshot`

### Для администратора

**GET** `/.netlify/functions/get-orders`
- Получает все заказы

**POST** `/.netlify/functions/send-stars`
- Отправляет Stars пользователю
- Параметры: `orderNumber`, `telegramUsername`, `stars`

**POST** `/.netlify/functions/reject-order`
- Отклоняет заказ
- Параметры: `orderNumber`, `reason`

**POST** `/.netlify/functions/telegram-webhook`
- Webhook для Telegram бота

## ?? Процесс оплаты

1. Пользователь выбирает пакет Stars
2. Вводит свой Telegram username
3. Загружает скриншот оплаты
4. Отправляет заказ
5. Админ получает уведомление в Telegram
6. Админ проверяет скриншот и подтверждает
7. Stars автоматически отправляются пользователю
8. Пользователь получает уведомление в Telegram

## ?? Telegram Уведомления

### Команды бота

- `/start` - начало
- `/orders` - список заказов
- `/stats` - статистика
- `/help` - справка

## ?? Решение проблем

### Заказы не сохраняются

- Проверьте права доступа на Netlify
- Убедитесь, что папка `orders` существует
- Проверьте переменные окружения

### Telegram уведомления не приходят

- Проверьте токен бота (`TELEGRAM_BOT_TOKEN`)
- Проверьте Chat ID (`TELEGRAM_ADMIN_CHAT_ID`)
- Убедитесь, что webhook установлен правильно

### Stars не отправляются

- Проверьте наличие Fragment API Key
- Убедитесь, что Telegram username правильный
- Проверьте логи Netlify

## ?? Поддержка

Если у вас возникли вопросы, свяжитесь с администратором через Telegram.

## ?? Лицензия

MIT License - свободно используйте в своих проектах

## ? Спасибо!

Спасибо за использование Telegram Stars Shop!
