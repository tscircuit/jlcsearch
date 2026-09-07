// Representative local data, not a snapshot of current JLC availability.
export const promotionalFixtureSql = `
DROP TABLE IF EXISTS search_index;
DROP TABLE IF EXISTS component_catalog;
DROP TABLE IF EXISTS resistor;
DROP TABLE IF EXISTS microcontroller;
DROP TABLE IF EXISTS analog_multiplexer;
CREATE TABLE component_catalog (
  lcsc INTEGER UNIQUE, category TEXT, subcategory TEXT, mfr TEXT, package TEXT,
  basic INTEGER, preferred INTEGER, is_extended_promotional INTEGER NOT NULL DEFAULT 0,
  description TEXT, stock INTEGER, price TEXT, extra TEXT
);
INSERT INTO component_catalog VALUES
  (1,'ICs','LCD Drivers','HT1621','SMD',0,1,1,'Promotional LCD driver',100,'1-9:0.50','{}'),
  (2,'ICs','LCD Drivers','HT1622','SMD',1,1,0,'Basic LCD driver',90,'1-9:0.60','{}'),
  (3,'ICs','LCD Drivers','HT1623','SMD',0,0,0,'Extended LCD driver',80,'1-9:0.70','{}'),
  (4,'ICs','LCD Drivers','ILI9341','QFN',0,1,1,'Promotional TFT display driver',70,'1-9:0.80','{}'),
  (5,'ICs','LCD Drivers','ILI9341V','QFN',0,0,0,'Extended TFT display driver',60,'1-9:0.90','{}'),
  (6,'ICs','LCD Drivers','HT1624','SMD',0,1,1,'Out of stock promotional driver',0,'1-9:0.40','{}'),
  (7,'Audio','Microphones','MIC-P','SMD',0,1,1,'Promotional microphone',50,'1-9:1.0','{}'),
  (8,'Audio','Microphones','MIC-E','SMD',0,0,0,'Extended microphone',40,'1-9:1.1','{}');
CREATE TABLE search_index AS SELECT *, 0.5 AS price1,
  lower(mfr || ' ' || description) AS search_text FROM component_catalog;
CREATE INDEX idx_search_index_is_extended_promotional_stock ON search_index(is_extended_promotional, stock DESC);
CREATE TABLE resistor(lcsc INTEGER PRIMARY KEY, mfr TEXT, stock INTEGER, package TEXT, resistance REAL, is_basic INTEGER, is_preferred INTEGER);
INSERT INTO resistor VALUES (1,'R-P',300,'0603',1000,0,1),(2,'R-B',200,'0603',1000,1,1),(999,'Unknown status',100,'0603',1000,0,0);
CREATE INDEX idx_resistor_package_stock ON resistor(package,stock DESC);
CREATE TABLE microcontroller(lcsc INTEGER PRIMARY KEY, mfr TEXT, stock INTEGER, package TEXT, cpu_core TEXT);
INSERT INTO microcontroller VALUES (1,'ARM-P',300,'QFN','ARM Cortex-M4'),(2,'ARM-E',200,'QFN','ARM Cortex-M4'),(4,'RV-P',100,'QFN','RISC-V'),(5,'RV-E',50,'QFN','RISC-V');
CREATE TABLE analog_multiplexer(lcsc INTEGER PRIMARY KEY,mfr TEXT,stock INTEGER,package TEXT,num_channels INTEGER);
INSERT INTO analog_multiplexer VALUES (1,'SW-P',300,'QFN',1),(2,'SW-E',200,'QFN',2),(4,'MUX-P',100,'QFN',4);
`
