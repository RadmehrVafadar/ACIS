# Invoice Reconciliation

Finance paused statement delivery after a customer disputed the balance on invoice **INV-1042**.
The individual charges and bank receipts agree with the customer's records, but the reported totals do not.

## Reproduce

1. Select **Run** and open the **Billing** preview.
2. Open **INV-1042** for Harbor Print Co. and compare the totals with its ledger.
3. Inspect the same invoice in `GET /api/invoices` and run the visible tests.

The posted charges total $200.00 and the payments total $120.00, leaving $80.00 outstanding.
Restore accurate balances across invoices, including equal-valued entries, empty invoices, and customer credits.
Keep the statement list efficient as the number of invoices grows.
