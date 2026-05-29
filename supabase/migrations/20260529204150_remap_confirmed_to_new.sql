-- The manual "confirmation" step is gone (confirmation email is now automatic),
-- so the `confirmed` status is removed from the app. Remap any existing order
-- still sitting in `confirmed` back to `new` (it will pick up the new pipeline:
-- Stripe → configure, Facture → générer la facture).
update orders set status = 'new' where status = 'confirmed';
