# Security Policy

## Supported branch

Security fixes are developed against `main`. This repository is a research and demonstration application; it is not a certified production database, laboratory information management system, or regulatory decision engine.

## Reporting a vulnerability

Do not publish credentials, private datasets, exploit payloads, or personally identifiable information in a public issue. Contact the repository owner privately through GitHub before disclosing technical details. Include:

- affected commit and file path;
- reproduction steps with sanitized data;
- expected and actual behavior;
- impact assessment;
- a minimal remediation proposal, when available.

## Credential incident response

A Gemini API credential was previously committed in `.env`. Removing the file from the current tree does **not** invalidate the credential or erase it from Git history. The repository owner must:

1. revoke the exposed key in the provider console immediately;
2. create a replacement key with the minimum required API and origin restrictions;
3. never commit `.env`, `.env.local`, service-account files, or exported cloud credentials;
4. consider rewriting repository history only after coordinating with all collaborators;
5. review provider usage and billing logs for unauthorized activity.

## Frontend environment variables

Vite embeds `VITE_*` variables into browser assets. A browser-delivered key is therefore not a secret. `VITE_GEMINI_API_KEY` is supported only for local demonstration with a disposable, restricted key. Production deployments should use an authenticated server-side proxy, rate limiting, request validation, audit logging, and secret management.

## Formula execution boundary

User-defined formulas are parsed by a white-listed numeric grammar. Dynamic JavaScript execution (`eval` and `new Function`) is not permitted. Supported constructs are numeric literals, `Props['property']` references, arithmetic operators, parentheses, constants, and documented mathematical functions.

## Data and AI limitations

AI-generated properties and formulation suggestions are hypotheses, not manufacturer specifications, certified test results, safety determinations, or regulatory approvals. Validate outputs against traceable source data and laboratory methods before use.
