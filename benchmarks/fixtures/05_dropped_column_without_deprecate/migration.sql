-- Breaking migration: Directly dropping active column during rolling deploy
ALTER TABLE accounts DROP COLUMN legacy_pin;
