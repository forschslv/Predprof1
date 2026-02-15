# Список всех измененных файлов

## Backend (Python)

### 1. NewAtt/main.py
**Изменения:**
- Исправлен отступ в функции `send_verification_email()` (строка 143)
- Упрощена логика получения пароля в функции `register()` (строка 201-202)
- Добавлен импорт `SetPasswordRequest` из schemas
- Добавлен новый эндпоинт `POST /set-password` для установки пароля

**Ключевые строки:**
- Строка 143: `def send_verification_email(to_email: str, code: str) -> None:`
- Строка 34: Импорт `SetPasswordRequest`
- Строки 253-280: Новый эндпоинт `/set-password`

### 2. NewAtt/schemas.py
**Изменения:**
- Добавлена новая схема `SetPasswordRequest` для валидации данных при установке пароля

**Ключевые строки:**
- Строки 119-122: Новая схема `SetPasswordRequest`

## Frontend (HTML/JavaScript)

### 1. front12345/register_login/register.html
**Изменения:**
- Улучшена валидация пароля (добавлено `.trim()` для обоих полей пароля)
- Исправлена логика отправки пароля на сервер (только если не пусто)

**Ключевые строки:**
- Строка 67: `const password = document.getElementById('password').value.trim();`
- Строка 68: `const passwordConfirm = document.getElementById('password_confirm').value.trim();`
- Строка 99: `if (password && password.length > 0) { data.password = password; }`

### 2. front12345/register_login/verify.html
**Изменения:**
- Полностью переработана страница верификации
- Добавлен раздел для установки пароля после верификации кода
- Добавлена логика проверки, установлен ли пароль при регистрации
- Добавлена опция пропуска установки пароля

**Ключевые моменты:**
- Две формы: для верификации кода и установки пароля
- Логика переключения между формами в зависимости от наличия пароля
- API вызовы для верификации кода и установки пароля

### 3. front12345/profile.html
**Изменения:**
- Добавлен раздел "Безопасность" с кнопкой для установки/изменения пароля
- Добавлена форма для ввода нового пароля (скрытая по умолчанию)

**Ключевые строки:**
- Строки 109-130: Раздел для управления паролем

### 4. front12345/js/profile.js
**Изменения:**
- Добавлена функция `setPassword()` для отправки нового пароля на сервер
- Добавлены обработчики событий для кнопок управления паролем
- Добавлена логика показа/скрытия формы для установки пароля

**Ключевые функции:**
- `setPassword()`: Отправляет новый пароль на сервер
- Обработчики для кнопок: changePasswordBtn, savePasswordBtn, cancelPasswordBtn

## Файлы, которые НЕ изменялись (но могут потребоваться обновления в будущем)

1. `front12345/register_login/login.html` - Работает корректно с текущей логикой
2. `NewAtt/models.py` - Уже имеет поле `password_hash`
3. `NewAtt/auth.py` - Уже правильно настроена аутентификация

## Порядок тестирования

1. **Синтаксис Python:**
   ```bash
   cd C:\Users\alexa\PycharmProjects\Predprof1\NewAtt
   python -m py_compile main.py
   ```

2. **Запуск приложения:**
   ```bash
   python main.py
   ```

3. **Проверка эндпоинтов:**
   - `POST /register` - Регистрация с паролем
   - `POST /verify-code` - Верификация кода
   - `POST /auth/token` - Логин с паролем
   - `POST /set-password` - Установка пароля

## Потенциальные проблемы и решения

### Если пароль не сохраняется при регистрации:
1. Проверить, передается ли поле `password` в JSON при регистрации
2. Проверить логи приложения на ошибки bcrypt
3. Убедиться, что пароль не длиннее 72 символов

### Если страница верификации не показывает форму для пароля:
1. Проверить консоль браузера на ошибки JavaScript
2. Убедиться, что API_URL правильно установлен в script.js
3. Проверить response от `/verify-code` - должен содержать поле `password_hash`

### Если логин с паролем не работает:
1. Убедиться, что пароль был сохранен при регистрации
2. Проверить, что пароль передается в JSON при логине
3. Проверить логи сервера на ошибки при проверке пароля

## API Endpoints

### Регистрация
```http
POST /register
Content-Type: application/json

{
  "name": "John",
  "secondary_name": "Doe",
  "email": "john@example.com",
  "status": "active",
  "password": "password123"  // необязательно
}
```

### Верификация кода
```http
POST /verify-code
Content-Type: application/json

{
  "email": "john@example.com",
  "code": "123456"
}

Response:
{
  "access_token": "...",
  "token_type": "bearer",
  "user": { ... }
}
```

### Логин с паролем
```http
POST /auth/token
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "...",
  "token_type": "bearer",
  "user": { ... }
}
```

### Установка пароля
```http
POST /set-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "newpassword123",
  "password_confirm": "newpassword123"
}

Response:
{
  "id": 1,
  "name": "John",
  ...
}
```

