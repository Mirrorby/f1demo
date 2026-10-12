# Первый запуск полностью через браузер

Для этого пути используйте ветку `feat/catalog-factory-mvp` и команду deploy `npm run deploy:cloudflare`. Компьютер пользователя не выполняет сборку, установку Node или служебные команды.

## Имена ресурсов

| Ресурс                          | Имя                        |
| ------------------------------- | -------------------------- |
| GitHub repository               | `Mirrorby/f1demo`          |
| Git branch                      | `feat/catalog-factory-mvp` |
| Worker                          | `catalog-factory`          |
| D1 database                     | `catalog-factory`          |
| R2 bucket                       | `catalog-factory-images`   |
| D1 binding                      | `DB`                       |
| R2 binding                      | `IMAGES`                   |
| Static Assets binding           | `ASSETS`                   |
| Cloudflare deployment API token | `catalog-factory-deploy`   |

Бот имеет произвольный свободный username, заканчивающийся на `bot`. Используйте отдельного бота для новой фабрики.

## 1. Telegram

В @BotFather отправьте `/newbot`, выберите название и свободный username. Сохраните токен в менеджере паролей. Username понадобится без `@`.

Подготовьте два разных случайных ключа: `PLATFORM_API_KEY` и `TELEGRAM_WEBHOOK_SECRET`. Генератор вашего менеджера паролей: 64 символа, латинские буквы и цифры. Ключ платформы минимум 32 символа. Webhook key 32–256 символов, разрешены латиница, цифры, `_`, `-`. Реальные значения не размещайте в GitHub, URL или сообщениях.

## 2. Cloudflare D1 и R2

В одном аккаунте Cloudflare:

- Storage & databases → D1 → Create database → `catalog-factory`. Сохраните Database ID (UUID). Отдельно скопируйте Account ID вашего аккаунта Cloudflare (32 шестнадцатеричных символа). Это два разных значения.
- Storage & databases → R2 → Overview: подключите R2 subscription, если ещё не подключена. Create bucket → `catalog-factory-images`, Standard storage, automatic location. Public r2.dev, отдельные CORS и S3 tokens для этого приложения не нужны.

Таблицы автоматически создаст deployment helper через `wrangler d1 migrations apply --remote`. Не вставляйте вручную миграцию в SQL Console при использовании этого пути: помощник ведёт историю миграций.

В Workers & Pages найдите поддомен аккаунта. Будущий адрес Worker — `https://catalog-factory.<поддомен>.workers.dev`. Это значение PUBLIC_ORIGIN; без путей `/admin`, `/platform` и без query string.

## 3. Токен Cloudflare для сборки

My Profile → API Tokens → Create Token → Custom Token. Имя: `catalog-factory-deploy`.

Права:

- Account → Account Settings → Read.
- Account → Workers Scripts → Edit.
- Account → Workers R2 Storage → Edit.
- Account → D1 → Edit.
- User → User Details → Read.
- User → Memberships → Read.

Account Resources: Include → Specific account → ваш аккаунт проекта. Сохраните токен. В настройке Workers Builds выберите этот token в поле API token. Автоматический стандартный build token может не иметь D1 Edit; это право нужно для миграции.

Этот токен Cloudflare отличается от PLATFORM_API_KEY. Первый управляет инфраструктурой при деплое, второй даёт доступ к панели фабрики.

## 4. Worker из GitHub

Workers & Pages → Create application → импорт из GitHub. Дайте Cloudflare доступ к `Mirrorby/f1demo`.

| Поле               | Значение                          |
| ------------------ | --------------------------------- |
| Name / Worker name | `catalog-factory`                 |
| Repository         | `Mirrorby/f1demo`                 |
| Production branch  | `feat/catalog-factory-mvp`        |
| Root directory     | корень репозитория, `/` или пусто |
| Build command      | `npm ci`                          |
| Deploy command     | `npm run deploy:cloudflare`       |
| API token          | `catalog-factory-deploy`          |

Не выбирайте Pages: этому проекту нужен Worker с Static Assets. На первом этапе отключите builds других веток.

## 5. Build variables и secrets

Добавляйте в Build variables and secrets (на этапе подключения или Worker → Settings → Build), не только в runtime Variables & Secrets.

| Имя                       | Тип       | Значение                                   |
| ------------------------- | --------- | ------------------------------------------ |
| `NODE_VERSION`            | Plaintext | `24`                                       |
| `CLOUDFLARE_ACCOUNT_ID`   | Plaintext | Account ID аккаунта Cloudflare             |
| `DATABASE_ID`             | Plaintext | UUID вашей D1 базы                         |
| `BOT_USERNAME`            | Plaintext | username бота без `@`                      |
| `PUBLIC_ORIGIN`           | Plaintext | полный HTTPS origin вашего Worker          |
| `PLATFORM_API_KEY`        | Secret    | первый случайный ключ из менеджера паролей |
| `TELEGRAM_BOT_TOKEN`      | Secret    | токен BotFather                            |
| `TELEGRAM_WEBHOOK_SECRET` | Secret    | второй случайный ключ                      |

Нажмите Deploy. Если wizard ещё не позволил добавить поля, сохраните созданный проект, откройте Settings → Build, добавьте значения и выберите Retry build с текущей конфигурацией.

Помощник создаёт временный конфиг с ID базы и публичными переменными, применяет миграции, затем публикует Worker и три runtime secrets. Временный файл секретов удаляется после команды. Оригинальный `wrangler.jsonc` в GitHub менять не требуется.

Build settings и runtime settings — разные. Для этого пути источником настроек служат Build variables/secrets; helper переносит их при каждом деплое. Изменения только в runtime dashboard будут заменены значениями Build при следующем deploy.

После успешного deploy проверьте:

- Основной адрес: стартовая страница.
- `/api/health`: `{"ok":true}`.
- Worker Settings → Variables & Secrets: BOT_USERNAME и PUBLIC_ORIGIN, а также три секрета.
- Bindings: DB → catalog-factory, IMAGES → catalog-factory-images, ASSETS.
- Cron: `*/10 * * * *` для повторных уведомлений.

## 6. Настройка фабрики

Откройте `<ваш origin>/platform`, введите PLATFORM_API_KEY, нажмите «Подключиться».

1. «Настроить Telegram-бота»: устанавливаются webhook, команды и кнопка меню. Сервер проверяет соответствие username токену.
2. Отправьте `/start` боту в личном чате: получите свой числовой Telegram ID.
3. На `/platform` создайте демо: название, slug (например `my-store`), описание, валюта, цвет. Для готового каталога есть поле JSON.
4. В карточке демо укажите Telegram ID, нажмите «Создать приглашение». Откройте полученную ссылку в соответствующем аккаунте Telegram и нажмите Start.
5. «Управлять магазином» открывает Mini App. Добавьте товары, фото и настройки.
6. Вернитесь в `/platform`, «Обновить список», затем «Активировать магазин». Кнопка подтверждает включение настоящих заказов.
7. Сайт: `/shop/my-store`. В демо: `/demo/my-store`.

Панель `/platform` предназначена для разработчика, управляющего всеми магазинами. Владельцам выдавайте персональные ссылки приглашения, без PLATFORM_API_KEY. Ключ панели не сохраняется в localStorage/sessionStorage; после закрытия/перезагрузки страницы вводится заново.

## 7. Проверка публичного запуска

Оформите один пробный заказ на активном сайте. Убедитесь, что он имеет серверный номер, пришёл владельцу в Telegram и появился в Mini App. Кнопка «Принять» должна сохранить статус. Проверьте фото и изменение настроек. Реальный аккаунт Cloudflare и настоящий Telegram нельзя заменить локальными тестами.

## Ошибки

- Ошибка permissions на D1: добавьте D1 Edit именно токену, выбранному в Build API token, и повторите build.
- DATABASE_ID не настроен: добавьте UUID в Build variables, не только runtime Variables.
- Не хватает секретов: три Secret поля должны быть в Build secrets.
- BOT_USERNAME не совпадает с токеном: проверьте бота в BotFather и оба Build поля, затем deploy.
- Панель владельца требует Telegram: открывайте `/admin` кнопкой из бота.
- После привязки активация ещё недоступна: обновите список в `/platform`.
