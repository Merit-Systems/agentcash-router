---
'@agentcash/router': patch
---

Fire onPaymentSettled for MPP transactions

MPP payments were missing the settlement plugin hook, so `payment_tx_hash` was always null for Tempo transactions in telemetry. After `withReceipt()`, the receipt is now extracted and `onPaymentSettled` fires with the transaction reference.
