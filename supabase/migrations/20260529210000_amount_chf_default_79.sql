-- Product price raised from 69 to 79 CHF (launch price).
-- The funnel always sends amount_chf explicitly; this default covers any
-- direct insert. google_business_url already defaults to '' (NOT NULL), so the
-- funnel dropping the Google field is a no-op at the DB layer.
alter table orders alter column amount_chf set default 79.00;
