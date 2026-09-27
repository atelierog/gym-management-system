# Gym Manager — Product Case Study

## Context
Gym Manager is a multi-tenant gym-management SaaS being developed under Atelier OG / Business OS. The product is intentionally scoped around the daily operational work of an independent gym.

## Problem
Small gyms commonly manage memberships, attendance, payments and renewals through paper or spreadsheets. The product goal is to bring those workflows into one mobile-first system without importing unnecessary enterprise complexity.

## V1 scope
- Members and trainers
- Membership plans, start/expiry/renewal
- Payments, dues and partial payments
- Attendance and checkout
- Reports and CSV export
- Reminders and gym settings
- Role-based portals

Out of V1: classes, POS, inventory, CRM, payroll, marketing automation, multi-branch scheduling and other enterprise surfaces.

## Product decisions
1. Keep V1 small and task-oriented.
2. Treat PostgreSQL as the source of truth.
3. Enforce tenant isolation at the database layer with RLS.
4. Keep security-sensitive operations server-authoritative.
5. Make money-changing workflows transactional.
6. Validate attendance on the server, including membership, role/status, location/radius, timezone, Sunday closure and duplicate-open-visit rules.
7. Add future features only when they replace a real manual task.

## Architecture
React/Vite + Supabase Auth + PostgreSQL/RLS + authenticated Edge Functions + Cloudflare Workers/Pages.

## Product thinking
Problem → user → MVP → workflow → UX → architecture → build → validate → iterate.

## AI product extension to validate
A possible next experiment is an operations copilot that summarizes expiring memberships and outstanding dues, cites the underlying records, and proposes safe outreach actions. The feature should be tested for factual accuracy, permission boundaries, action safety and time saved before broader automation.

## Evidence
See `README.md` and `docs/ARCHITECTURE.md` for the current V1 scope, architecture, security model, transaction boundaries and release gates.
