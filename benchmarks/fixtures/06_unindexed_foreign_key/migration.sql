-- Migration: Adding unindexed foreign key causing table scans
ALTER TABLE orders ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id);
