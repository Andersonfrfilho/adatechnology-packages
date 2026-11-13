-- Resgate de compra pelo código da transação: a busca é por (provedor, transação).
CREATE INDEX IF NOT EXISTS "idx_payment_events_transaction" ON "payment"."payment_events" USING btree ("provider","transaction_id");
