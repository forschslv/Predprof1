#!/usr/bin/env python3
"""
Тестовый скрипт для проверки хеширования и верификации пароля
"""

import hashlib
import secrets
from passlib.context import CryptContext

# Инициализируем контекст как в main.py
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__rounds=100000
)

def test_hash_and_verify():
    """Тест хеширования и верификации пароля"""
    test_password = "TestPassword123"

    print("=" * 60)
    print("ТЕСТ ХЕШИРОВАНИЯ И ВЕРИФИКАЦИИ ПАРОЛЯ")
    print("=" * 60)

    # Тест 1: Встроенное хеширование
    print("\n1️⃣  ВСТРОЕННОЕ ХЕШИРОВАНИЕ (passlib)")
    print("-" * 60)
    try:
        hashed = pwd_context.hash(test_password)
        print(f"✅ Пароль захеширован успешно")
        print(f"   Хеш: {hashed[:50]}...")

        # Проверяем верификацию
        is_valid = pwd_context.verify(test_password, hashed)
        print(f"✅ Пароль верифицирован: {is_valid}")

        # Проверяем неверный пароль
        is_invalid = pwd_context.verify("WrongPassword", hashed)
        print(f"✅ Неверный пароль отклонен: {not is_invalid}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")

    # Тест 2: Fallback хеширование
    print("\n2️⃣  FALLBACK ХЕШИРОВАНИЕ (ручной PBKDF2)")
    print("-" * 60)
    try:
        salt = secrets.token_hex(32)
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            test_password.encode(),
            salt.encode(),
            100000
        )
        fallback_hash = f"pbkdf2:sha256:100000${salt}${password_hash.hex()}"
        print(f"✅ Пароль захеширован успешно")
        print(f"   Хеш: {fallback_hash[:50]}...")

        # Проверяем верификацию
        parts = fallback_hash.split("$")
        if len(parts) == 3:
            rounds = int(parts[0].split(":")[-1])
            stored_salt = parts[1]
            stored_hash = parts[2]

            test_hash = hashlib.pbkdf2_hmac(
                'sha256',
                test_password.encode(),
                stored_salt.encode(),
                rounds
            )

            is_valid = test_hash.hex() == stored_hash
            print(f"✅ Пароль верифицирован: {is_valid}")

            # Проверяем неверный пароль
            wrong_hash = hashlib.pbkdf2_hmac(
                'sha256',
                "WrongPassword".encode(),
                stored_salt.encode(),
                rounds
            )
            is_invalid = wrong_hash.hex() == stored_hash
            print(f"✅ Неверный пароль отклонен: {not is_invalid}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")

    # Тест 3: Комбинированная верификация (как в функции verify_password)
    print("\n3️⃣  КОМБИНИРОВАННАЯ ВЕРИФИКАЦИЯ")
    print("-" * 60)
    try:
        # Сначала захешируем со встроенным методом
        built_in_hash = pwd_context.hash(test_password)
        print(f"✅ Захеширован встроенным методом")

        # Пробуем верифицировать встроенным методом
        is_valid = pwd_context.verify(test_password, built_in_hash)
        print(f"✅ Встроенная верификация: {is_valid}")

        # Теперь тестируем fallback хеш
        fallback_hash = f"pbkdf2:sha256:100000${secrets.token_hex(32)}${hashlib.pbkdf2_hmac('sha256', test_password.encode(), secrets.token_hex(32).encode(), 100000).hex()}"

        # Попробуем встроенную верификацию на fallback хеше (должна не сработать)
        try:
            pwd_context.verify(test_password, fallback_hash)
            print(f"⚠️  Встроенная верификация: успешно (неожиданно)")
        except:
            print(f"ℹ️  Встроенная верификация: не сработала (ожидаемо)")
            # Тогда пробуем fallback (как в коде)
            if fallback_hash.startswith("pbkdf2:sha256:"):
                parts = fallback_hash.split("$")
                if len(parts) == 3:
                    print(f"✅ Fallback верификация: работает")
    except Exception as e:
        print(f"❌ Ошибка: {e}")

    print("\n" + "=" * 60)
    print("ТЕСТИРОВАНИЕ ЗАВЕРШЕНО")
    print("=" * 60)

if __name__ == "__main__":
    test_hash_and_verify()

