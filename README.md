# Фабрика сайтов-каталогов

MVP универсального магазина на основе f1demo: общая витрина, Cloudflare Worker + D1 + R2, Telegram-бот и мобильная Mini App. JSON создаёт отдельную демонстрацию; после привязки владельца её можно активировать. Основная витрина и корзина переиспользованы из исходного сайта.

Корневой `index.html` — неизменённый исходник на Google Sheets для сохранения рабочей версии. Рабочее приложение использует только `public/` и `src/`, без Sheets, Apps Script, GitHub Pages и VPS.

## Локальный запуск

Требуется Node.js 24, npm. Cloudflare-аккаунт для локального D1/R2 не нужен.

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run dev
```

В `.dev.vars` замените ключ платформы на случайную строку минимум 32 символа. Telegram token и webhook secret нужны для работы настоящего бота; интеграционные тесты используют собственные тестовые значения и полностью имитируют Telegram. Никогда не публикуйте `.dev.vars` и `.env`.

В другом терминале установите **такой же** `PLATFORM_API_KEY` в окружение CLI (через секреты shell/менеджер окружения, без записи реальных значений в GitHub). CLI не читает `.dev.vars` автоматически.

```bash
npm run store -- create examples/mira-bags.json
```

Команда вернёт ID магазина и ссылку `http://localhost:8787/demo/mira-bags`. Демо позволяет просмотреть карточки и корзину, но не сохраняет заказы и скрывает контакты продавца. Mini App открывается через Telegram-бота, а не через отдельный логин в браузере.

## Проверка

```bash
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

`npm test` использует настоящий локальный Workers runtime, D1 и R2 с имитацией Telegram API. `test:browser` поднимает собственное временное окружение с тестовыми initData, запускает Chromium и проверяет Mini App → витрину → оформление заказа → D1 → статус. Авторизация в рабочем коде не отключается. Browser smoke проверяет 375/390/1280 px, экранирование строк и ошибки сохранения. `build` — dry run, ничего не публикует.

Для своего установленного Chromium можно задать `CHROMIUM_EXECUTABLE`. Для временных скриншотов — `BROWSER_SCREENSHOT_DIR`. Служебные тестовые магазины не попадают в рабочую базу.

Подробные результаты: [docs/verification.md](docs/verification.md).

## Развёртывание Cloudflare и Telegram

1. Авторизуйте Wrangler: `npx wrangler login`.
2. Создайте отдельную БД: `npx wrangler d1 create catalog-factory`. Вставьте её `database_id` в `wrangler.jsonc` вместо нулевого placeholder.
3. Создайте бакет: `npx wrangler r2 bucket create catalog-factory-images`. Не включайте публичный r2.dev: фото выдаёт Worker.
4. Установите `PUBLIC_ORIGIN` (будущий HTTPS-адрес Worker/домена) и `BOT_USERNAME` в `wrangler.jsonc`. Создайте бота в @BotFather.
5. Задайте секреты интерактивно:

```bash
npx wrangler secret put PLATFORM_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

6. Проверьте отдельное окружение перед рабочими данными:

```bash
npx wrangler d1 migrations apply catalog-factory --remote
npm run types
npm run check
npm test
npm run build
npx wrangler deploy
```

7. Установите секреты Telegram и `PUBLIC_ORIGIN` в окружение локального setup-скрипта и выполните `npm run telegram:setup`. Он настроит защищённый webhook, команды и кнопку меню. Не вводите секреты в аргументы команд и не публикуйте их в чатах или GitHub.
8. Откройте `/start` в личном чате с ботом. Пока магазина нет, бот покажет Telegram ID. Создайте демо и приглашение на этот ID:

```bash
# STORE_API_ORIGIN в окружении CLI должен указывать на ваш HTTPS Worker.
npm run store -- create examples/mira-bags.json
npm run store -- invite STORE_ID TELEGRAM_USER_ID
```

9. Передайте ссылку приглашения владельцу. Он открывает её в указанном аккаунте Telegram и получает «Управлять магазином». Ссылка действует 24 часа и не позволяет привязаться другому аккаунту.
10. После проверки наполнения и согласия на продажу активируйте:

```bash
npm run store -- activate STORE_ID
```

Ссылка станет `/shop/:slug`; старый `/demo/:slug` перенаправляет на неё. Заказы сохраняются, владелец получает Telegram-уведомление, кнопки меняют реальные статусы. При ошибке Telegram уведомления повторяет cron каждые 10 минут.

Для staging создайте отдельные Worker/БД/бакет/бот и отдельную конфигурацию, не делите продуктивные данные с тестовым окружением. CI только проверяет код; автоматического production deploy или merge нет.

## JSON и импорт таблицы

[examples/mira-bags.json](examples/mira-bags.json) показывает формат. Цены `prices` — целые минимальные единицы: `8500` BYN = `85.00 BYN`. Упрощённые `price`/`currency` поддерживаются для магазина с одной валютой. Варианты: подпись + остаток; пустой/NULL остаток = без ограничения. Новые ID генерируются сервером. Категория создаётся из поля товара.

Одноразовый импорт исходного XLSX (требуется `python -m pip install openpyxl`):

```bash
python scripts/import_xlsx.py path/to/source.xlsx /tmp/store-import.json
npm run store -- create /tmp/store-import.json
```

Исходная таблица не изменяется. Исторические заказы и контакты не импортируются. Для разрешённых фотографий есть `--include-images`; Drive URL преобразуются в ссылки на изображения. Для независимого размещения фото загрузите их в R2 через Mini App.

## Экспорт и передача

```bash
npm run store -- export STORE_ID /tmp/store-export.json
```

Экспорт содержит каталог, настройки, варианты и ссылки на фото. Он не передаёт аккаунт владельца и историю заказов. Для создания нового демо из экспорта сначала перенесите R2-файлы и замените внутренние `/media/...` ссылки на доступные HTTPS-URL либо уберите фото/логотип и загрузите их заново в новом магазине. CLI удаляет старые ID и создаёт новые.

## Структура и границы

- `src/`: API, валидация, Telegram HMAC, каталог, заказы и уведомления.
- `public/`: витрина и Mini App без frontend-фреймворка.
- `migrations/`: схема D1 и атомарные операции с остатками.
- `scripts/`: фабрика JSON, настройка бота, одноразовый XLSX-импорт.
- `tests/`: API/D1/R2 и browser smoke.
- `.github/workflows/ci.yml`: проверки без production deploy.
- [Аудит](docs/audit.md), [архитектура и API](docs/architecture.md), [квоты и стоимость](docs/costs.md).

Пока не реализованы индивидуальные домены, автоматическая передача отдельного Cloudflare-аккаунта, парсер Instagram, автоматические сообщения потенциальным клиентам, онлайн-оплата и CRM. Фотографии и брендинг персонализированных демо используйте с разрешения владельца.
