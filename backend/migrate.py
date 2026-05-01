import sys
sys.path.append(".")
from db import get_connection
from werkzeug.security import generate_password_hash

def migrate():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Add password column
    try:
        cursor.execute("ALTER TABLE User ADD COLUMN password VARCHAR(255)")
        print("Added password column.")
    except Exception as e:
        print("Password col edit:", e)
        
    # Add role column
    try:
        cursor.execute("ALTER TABLE User ADD COLUMN role ENUM('admin', 'user') DEFAULT 'user'")
        print("Added role column.")
    except Exception as e:
        print("Role col edit:", e)
    
    # Insert default admin if not exists
    hashed = generate_password_hash("admin123")
    try:
        cursor.execute("""
            INSERT IGNORE INTO User (name, email, phone, password, role) 
            VALUES (%s, %s, %s, %s, %s)
        """, ("System Admin", "admin@ev.com", "0000000000", hashed, "admin"))
        print("Inserted default admin user: admin@ev.com / admin123")
    except Exception as e:
        print("Insert admin:", e)
        
    conn.commit()
    cursor.close()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
