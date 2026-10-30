-- Dangerous migration: Adding NOT NULL column without DEFAULT locks 10M rows in PostgreSQL/MySQL
ALTER TABLE users ADD COLUMN billing_tier VARCHAR(32) NOT NULL;
