import sqlite3

def init_db():
    conn = sqlite3.connect('db.sqlite3')
    cursor = conn.cursor()
    
    # Create categories table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        subcategory TEXT
    )
    ''')
    
    # Create components table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS components (
        lcsc INTEGER PRIMARY KEY,
        mfr TEXT,
        package TEXT,
        description TEXT,
        stock INTEGER,
        price TEXT,
        basic INTEGER,
        preferred INTEGER,
        category_id INTEGER,
        datasheet TEXT,
        extra TEXT,
        flag INTEGER,
        last_on_stock INTEGER,
        last_update INTEGER,
        manufacturer_id INTEGER,
        is_extended_promotional INTEGER
    )
    ''')

    # Create components_fts virtual table
    cursor.execute('''
    CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(
        lcsc, mfr, description, mfr_chars
    )
    ''')
    
    # Create v_components view
    cursor.execute('''
    CREATE VIEW IF NOT EXISTS v_components AS
    SELECT c.*, cat.category, cat.subcategory
    FROM components c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ''')
    
    # Insert dummy data for tests
    cursor.execute("INSERT OR REPLACE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id, is_extended_promotional) VALUES (1002, 'TEST-MFR', 'TEST-PKG', 'TEST-DESC', 100, '1.0', 1, 1, 1, 0)")
    cursor.execute("INSERT OR REPLACE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id, is_extended_promotional) VALUES (1003, 'STM32F401RCT6', 'LQFP-64', 'ARM Microcontroller', 50, '5.0', 0, 1, 1, 1)")
    cursor.execute("INSERT OR REPLACE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id, is_extended_promotional) VALUES (1004, '555 Timer', 'DIP-8', '555 Precision Timer', 200, '0.5', 1, 1, 1, 0)")
    cursor.execute("INSERT OR REPLACE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id, is_extended_promotional) VALUES (1005, 'Red LED', '0603', 'Red LED 20mA', 1000, '0.01', 1, 1, 1, 0)")

    # Sync FTS table
    cursor.execute("INSERT INTO components_fts (lcsc, mfr, description, mfr_chars) SELECT lcsc, mfr, description, mfr FROM components")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
