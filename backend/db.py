"""
db.py – MySQL connection helper
Database: EV_Charging_System
"""

import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 3306)),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", ""),
            database=os.getenv("DB_NAME", "EV_Charging_System"),
            autocommit=True,
            connection_timeout=4,
        )
        return conn
    except Error as e:
        raise ConnectionError(f"Database connection failed: {e}")


def check_db_available():
    try:
        conn = get_connection()
        conn.close()
        return True
    except Exception:
        return False
