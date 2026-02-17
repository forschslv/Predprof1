"""Небольшой скрипт для добавления колонки `allergies` в таблицу `users` SQLite БД.
Если колонка уже существует, ничего не делает.
Запуск: python add_allergies_column.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

def column_exists(conn, table, column):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info('{table}')")
    cols = [row[1] for row in cur.fetchall()]
    return column in cols


def add_column_if_missing(db_path: str):
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    try:
        if column_exists(conn, 'users', 'allergies'):
            print('Column `allergies` already exists in table `users`. No action taken.')
            return
        # ALTER TABLE to add the column
        cur = conn.cursor()
        cur.execute("ALTER TABLE users ADD COLUMN allergies TEXT")
        conn.commit()
        print('Column `allergies` successfully added to table `users`.')
    except sqlite3.OperationalError as e:
        print('OperationalError:', e)
    finally:
        conn.close()


if __name__ == '__main__':
    add_column_if_missing(DB_PATH)

