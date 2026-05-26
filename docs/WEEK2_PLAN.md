# Week 2 Plan (Day 5-6)

## Day 5 — Staff login UX hardening
- Add client-side validation for empty login/password before API call.
- Show inline helpful validation message.
- Support Enter key submission for faster keyboard flow.

## Day 6 — Coordination note
- Capture frontend changes and backend impact (none expected for API contract).
- Keep `/api/staff/login` request shape unchanged.

## Manual check
- Open `/staff-login` and verify:
  - Empty form shows validation message and does not call API.
  - Enter key triggers submit.
  - Login button shows loading state and is disabled while request is in progress.
