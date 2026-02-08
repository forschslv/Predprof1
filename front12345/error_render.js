/*
 * error_render.js - Универсальный рендерер страницы ошибок
 * Динамически обновляет страницу error.html на основе параметров URL или localStorage
 */

const ERROR_CONFIGS = {
    '400': {
        title: 'Некорректный запрос',
        description: 'Сервер не может обработать ваш запрос из-за синтаксической ошибки.',
        icon: '❌',
        showDetails: true
    },
    '401': {
        title: 'Неавторизованный доступ',
        description: 'Для доступа к этой странице требуется авторизация.',
        icon: '🔒',
        showDetails: false
    },
    '403': {
        title: 'Доступ запрещён',
        description: 'У вас недостаточно прав для доступа к этой странице.',
        icon: '🚫',
        showDetails: false
    },
    '404': {
        title: 'Страница не найдена',
        description: 'Запрашиваемая страница не существует или была перемещена.',
        icon: '🔍',
        showDetails: false
    },
    '500': {
        title: 'Внутренняя ошибка сервера',
        description: 'Произошла непредвиденная ошибка на сервере.',
        icon: '⚙️',
        showDetails: true
    },
    '503': {
        title: 'Сервис недоступен',
        description: 'Сервер временно не может обработать запрос.',
        icon: '🛠️',
        showDetails: true
    },
    'network': {
        title: 'Ошибка сети',
        description: 'Не удалось подключиться к серверу. Проверьте интернет-соединение.',
        icon: '📡',
        showDetails: true
    },
    'default': {
        title: 'Произошла ошибка',
        description: 'Что-то пошло не так. Пожалуйста, попробуйте позже.',
        icon: '⚠️',
        showDetails: true
    }
};

// Основная функция инициализации
function initErrorPage() {
    const params = getErrorParams();
    const config = getErrorConfig(params.code);
    
    updateErrorElements(config, params);
    setupEventListeners();
    updateErrorMeta(params);
    
    console.log('Error page initialized with:', params);
}

// Получение параметров ошибки из URL или localStorage
function getErrorParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const storedError = localStorage.getItem('last_error');
    
    let code = urlParams.get('code') || '500';
    let message = urlParams.get('message') || '';
    let details = urlParams.get('details') || '';
    let timestamp = urlParams.get('timestamp') || new Date().toISOString();
    
    // Если есть сохранённая ошибка в localStorage, используем её
    if (storedError) {
        try {
            const parsed = JSON.parse(storedError);
            code = parsed.code || code;
            message = parsed.message || message;
            details = parsed.details || details;
            timestamp = parsed.timestamp || timestamp;
            localStorage.removeItem('last_error'); // Очищаем после использования
        } catch (e) {
            console.warn('Failed to parse stored error:', e);
        }
    }
    
    // Если нет message, используем описание из конфига
    if (!message) {
        const config = getErrorConfig(code);
        message = config.description;
    }
    
    return { code, message, details, timestamp };
}

// Получение конфигурации для кода ошибки
function getErrorConfig(code) {
    return ERROR_CONFIGS[code] || ERROR_CONFIGS['default'];
}

// Обновление элементов страницы
function updateErrorElements(config, params) {
    // Обновляем иконку
    const iconEl = document.querySelector('.error-icon');
    if (iconEl) iconEl.textContent = config.icon;
    
    // Обновляем код ошибки
    const codeEl = document.getElementById('errorCode');
    if (codeEl) codeEl.textContent = params.code;
    
    // Обновляем заголовок
    const titleEl = document.getElementById('errorTitle');
    if (titleEl) titleEl.textContent = config.title;
    
    // Обновляем описание
    const descEl = document.getElementById('errorDescription');
    if (descEl) descEl.textContent = params.message;
    
    // Обновляем детали ошибки
    const detailsEl = document.getElementById('errorDetailsText');
    const detailsContainer = document.getElementById('errorDetails');
    if (detailsEl && params.details) {
        detailsEl.textContent = params.details;
        detailsContainer.style.display = config.showDetails ? 'block' : 'none';
    } else {
        detailsContainer.style.display = 'none';
    }
    
    // Обновляем кнопку показа деталей
    const toggleBtn = document.getElementById('toggleDetailsBtn');
    if (toggleBtn) {
        toggleBtn.style.display = params.details ? 'inline-block' : 'none';
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка показа/скрытия деталей
    const toggleBtn = document.getElementById('toggleDetailsBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const detailsEl = document.getElementById('errorDetails');
            if (detailsEl.style.display === 'none') {
                detailsEl.style.display = 'block';
                toggleBtn.textContent = '📋 Скрыть детали';
            } else {
                detailsEl.style.display = 'none';
                toggleBtn.textContent = '📋 Показать детали';
            }
        });
    }
    
    // Кнопка копирования деталей ошибки
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-secondary';
    copyBtn.innerHTML = '📋 Копировать детали';
    copyBtn.style.marginLeft = '10px';
    
    copyBtn.addEventListener('click', function() {
        const detailsText = document.getElementById('errorDetailsText').textContent;
        const errorCode = document.getElementById('errorCode').textContent;
        const errorTitle = document.getElementById('errorTitle').textContent;
        
        const textToCopy = `Код ошибки: ${errorCode}\nЗаголовок: ${errorTitle}\nДетали:\n${detailsText}`;
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '✅ Скопировано!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Ошибка копирования:', err);
                alert('Не удалось скопировать текст');
            });
    });
    
    // Добавляем кнопку копирования, если есть детали
    const detailsContainer = document.getElementById('errorDetails');
    if (detailsContainer && detailsContainer.style.display !== 'none') {
        const actionsContainer = document.querySelector('.error-actions');
        if (actionsContainer) {
            actionsContainer.appendChild(copyBtn);
        }
    }
}

// Обновление мета-информации об ошибке
function updateErrorMeta(params) {
    const metaEl = document.getElementById('errorMeta');
    if (!metaEl) return;
    
    const timestamp = new Date(params.timestamp);
    const formattedTime = timestamp.toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    metaEl.innerHTML = `
        <div>ID ошибки: <strong>${generateErrorId()}</strong></div>
        <div>Время: ${formattedTime}</div>
        <div>Путь: ${window.location.pathname}</div>
    `;
}

// Генерация уникального ID ошибки
function generateErrorId() {
    return 'ERR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Утилита для перехода на страницу ошибки из других скриптов
window.showErrorPage = function(code, message, details) {
    const errorData = {
        code: code || '500',
        message: message || '',
        details: details || '',
        timestamp: new Date().toISOString()
    };
    
    // Сохраняем в localStorage для передачи на страницу ошибки
    localStorage.setItem('last_error', JSON.stringify(errorData));
    
    // Переходим на страницу ошибки
    window.location.href = 'error.html';
};

// Утилита для обработки ошибок API
window.handleApiError = async function(response) {
    if (!response || !response.status) {
        window.showErrorPage('network', 'Ошибка сети', 'Не удалось получить ответ от сервера');
        return;
    }
    
    try {
        const errorData = await response.json();
        window.showErrorPage(
            response.status.toString(),
            errorData.detail || `Ошибка ${response.status}`,
            JSON.stringify(errorData, null, 2)
        );
    } catch (e) {
        window.showErrorPage(
            response.status.toString(),
            `Ошибка ${response.status}: ${response.statusText}`,
            'Не удалось разобрать ответ сервера'
        );
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initErrorPage);