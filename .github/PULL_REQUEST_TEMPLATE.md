## ⚓ ShipSafe Pull Request Pre-Flight Checklist

### 1. Change Summary
<!-- Describe the change, the business problem it solves, and the affected modules. -->

### 2. Pre-Flight Quality Gate Verification
- [ ] Ran `shipsafe scan` locally and verified 0 critical health hazards.
- [ ] Verified database migrations for table locks (`ALTER TABLE ... ADD NOT NULL` with DEFAULT).
- [ ] Verified zero missing environment variables in `.env.example` (run `shipsafe fix` to sync).
- [ ] Verified zero N+1 queries or synchronous blocking calls in server paths.
- [ ] Confirmed Blast Radius is contained (`< 50%` or verified by tech lead).

### 3. Blast Radius & Operational Risk
- **Estimated Blast Radius Score:** `[ ] %`
- **Critical Infrastructure Touched (Auth / Billing / DB):** `None / Yes`
- **Rollback Plan Tested:** `Yes / N/A`
