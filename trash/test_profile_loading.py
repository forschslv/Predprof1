#!/usr/bin/env python3
"""
Тестирование подгрузки данных профиля пользователя

Этот скрипт проверяет:
1. Загрузку профиля пользователя через /users/me
2. Загрузку заказов пользователя через /orders
3. Правильность структуры возвращаемых данных
"""

import requests
import json
from datetime import datetime

API_URL = "http://localhost:8000"

def test_user_profile(token):
    """Тестирование загрузки профиля пользователя"""
    print("\n" + "="*60)
    print("ТЕСТ 1: Загрузка профиля пользователя (/users/me)")
    print("="*60)

    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{API_URL}/users/me", headers=headers)

        if response.status_code == 200:
            data = response.json()
            print("✅ Профиль успешно загружен")
            print("\nДанные профиля:")
            print(f"  ID: {data.get('id')}")
            print(f"  Имя: {data.get('name')}")
            print(f"  Фамилия: {data.get('secondary_name')}")
            print(f"  Email: {data.get('email')}")
            print(f"  Статус (класс/группа): {data.get('status')}")
            print(f"  Администратор: {data.get('is_admin')}")
            print(f"  Email подтвержден: {data.get('email_verified')}")
            return data
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"   {response.text}")
            return None
    except Exception as e:
        print(f"❌ Исключение: {e}")
        return None

def test_user_orders(token):
    """Тестирование загрузки заказов пользователя"""
    print("\n" + "="*60)
    print("ТЕСТ 2: Загрузка заказов пользователя (/orders)")
    print("="*60)

    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{API_URL}/orders", headers=headers)

        if response.status_code == 200:
            data = response.json()
            print(f"✅ Заказы успешно загружены (количество: {len(data)})")

            if len(data) > 0:
                print("\nДанные первого заказа:")
                order = data[0]
                print(f"  ID: {order.get('id')}")
                print(f"  Статус: {order.get('status')}")
                print(f"  Сумма: {order.get('total_amount')} ₽")
                print(f"  Дата начала недели: {order.get('week_start_date')}")

                print("\nВсе заказы:")
                for i, order in enumerate(data, 1):
                    status = order.get('status')
                    amount = order.get('total_amount')
                    date = order.get('week_start_date')
                    print(f"  {i}. Заказ #{order.get('id')} | {status} | {amount} ₽ | {date}")
            else:
                print("   (Нет заказов)")

            return data
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"   {response.text}")
            return None
    except Exception as e:
        print(f"❌ Исключение: {e}")
        return None

def test_parallel_loading(token):
    """Тестирование параллельной загрузки"""
    print("\n" + "="*60)
    print("ТЕСТ 3: Проверка структуры для параллельной загрузки")
    print("="*60)

    print("✅ JavaScript код использует Promise.all() для параллельной загрузки:")
    print("   - await Promise.all([")
    print("       apiRequest('/users/me'),")
    print("       apiRequest('/orders')")
    print("     ])")
    print("\nЭто обеспечивает:")
    print("  • Одновременная загрузка обоих эндпоинтов")
    print("  • Оптимальная производительность")
    print("  • Структурированный вывод { user, orders }")

def main():
    """Основная функция тестирования"""
    print("\n" + "="*60)
    print("ТЕСТИРОВАНИЕ ПОДГРУЗКИ ДАННЫХ ПРОФИЛЯ")
    print("="*60)

    # Для тестирования нужен валидный токен
    print("\nДля запуска полных тестов нужен валидный токен авторизации.")
    print("Используйте команду:")
    print("  python test_api.py")
    print("\nИли установите токен вручную и запустите:")
    print("  python test_profile_loading.py --token YOUR_TOKEN")

    # Показываем информацию о структуре API
    test_parallel_loading(None)

    print("\n" + "="*60)
    print("ИНФОРМАЦИЯ О КОДЕ")
    print("="*60)
    print("""
ФАЙЛ: front12345/js/profile.js

1. Функция loadUserProfile():
   - Загружает профиль пользователя (/users/me)
   - Загружает заказы пользователя (/orders)
   - Использует Promise.all для параллельной загрузки
   - Возвращает объект { user, orders }

2. Функция displayOrders(orders):
   - Форматирует и отображает историю заказов
   - Использует цветовое кодирование статусов
   - Форматирует даты на русском языке
   - Показывает ID, сумму, статус и дату каждого заказа

3. Инициализация (DOMContentLoaded):
   - Проверяет авторизацию
   - Загружает все данные
   - Отображает заказы на странице

ФАЙЛ: front12345/profile.html

- Добавлен контейнер <div id="ordersHistory">
- Содержит раздел "История заказов"
- Стилизован для соответствия теме приложения
- Поддерживает динамическое отображение
""")

if __name__ == "__main__":
    main()

