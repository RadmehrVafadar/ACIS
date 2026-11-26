# Invoice Reconciliation

This Django REST service prepares account statements from invoice lines and posted payments.
Finance reported that an invoice with multiple payments disagrees with its source ledger.

## Reproduce

1. Start the service with **Run** and open the **Billing** preview on port 8080.
2. View invoice **INV-1042**, then compare the three totals with its charge and payment entries.
3. Select **Statement API** to inspect the batch response.
4. Select **Run Tests** to check the repair against PostgreSQL.

Harbor Print Co. has two $85.00 service lines, one $30.00 delivery charge, and two $60.00 payments.
The invoice should show $200.00 in charges, $120.00 received, and an $80.00 balance.

## Statement contract

`GET /api/invoices` returns an object with an `invoices` array ordered by invoice number.
Each entry contains `number`, `customer`, `billed_cents`, `paid_cents`, and `balance_cents`.
All amounts are integer US cents.
Count each ledger entry once, including entries with the same amount.
Missing charges or payments contribute zero and an overpayment produces a negative balance.
The HTML view and batch API must agree without changing the underlying ledger.
The endpoint should use at most three database queries regardless of the number of invoices.

## Commands

From the workspace terminal:

```bash
bash run.sh
bash test.sh
```

The tests use their own PostgreSQL database.
Use `bash seed.sh` in the workspace terminal to restore the demonstration ledger.
