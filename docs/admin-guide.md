# Admin Guide

This guide covers administrative workflows for managing users, cohorts, and platform health.

## Access & Roles

- **Super Admins** manage global configuration and can access all admin areas.
- **Partners** manage organization-specific data and users for their assigned organizations.
- **Mentors** focus on cohort engagement and learner support.

## User Management

- Verify users have the correct **role**, **account status**, and **transformation tier**.
- Ensure onboarding fields are consistent after migrations.
- Use role-based dashboards for targeted workflows.

## Cohort & Organization Setup

- Confirm organization identifiers match partner records.
- Assign admins to organizations via `assignedOrganizations`.
- Update cohort identifiers for reporting alignment.

## Operational Checks

- Validate login routing for each role after updates.
- Monitor for failed migrations in the `migration_runs` collection.
- Run reconciliation scripts for any data migrations before going live.

## Incident Response

- For suspended accounts, document the reason and next steps.
- If account status prevents login, coordinate with support to resolve.
- Use the QA test suite before any release.
