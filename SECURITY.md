# Security Policy

The security of **dropdx** and the integrity of software supply chains are paramount. We appreciate any efforts to responsibly disclose vulnerabilities.

---

## Supported Versions

Only the latest active versions of **dropdx** receive security updates and bug fixes:

| Version   | Supported          |
| :-------- | :----------------- |
| `0.x.x`   | :white_check_mark: |
| `< 0.1.0` | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability or potential threat in **dropdx**, please do **NOT** open a public issue or discuss it in public forums.

Instead, please report it through one of the following private channels:

1. **GitHub Private Vulnerability Advisory** (Preferred):
   - Navigate to the [Security Advisories](https://github.com/dcdavidev/dropdx/security/advisories) tab of this repository.
   - Click **"Report a vulnerability"** to submit your report confidentially.

2. **Direct Email**:
   - Send an email to **Davide Di Criscito** at: `dcdavidev@gmail.com`
   - Include the subject line: `[SECURITY] dropdx Vulnerability Report`

---

## What to Include in Your Report

To help us triage and investigate the issue quickly, please provide as much relevant information as possible:

- **Type of vulnerability**: (e.g., command injection, token exposure, prototype pollution).
- **Affected component**: (e.g., `.npmrc` parser, git utility, registry client).
- **Step-by-step reproduction**: Clear, deterministic steps or a minimal reproduction repository.
- **Proof of Concept (PoC)**: Sample commands or scripts demonstrating the vulnerability.
- **Potential impact**: An explanation of how an attacker could exploit the issue and what assets could be affected.

---

## Response Process & Timelines

1. **Acknowledgment**: We aim to acknowledge receipt of your security vulnerability report within **48 hours**.
2. **Assessment & Validation**: We will confirm the vulnerability and assess its severity, scope, and impact.
3. **Patch & Coordinated Disclosure**: A patch will be developed and verified. We will coordinate a disclosure timeline with you before releasing the fix publicly.

Thank you for helping us keep **dropdx** and the developer community secure!
