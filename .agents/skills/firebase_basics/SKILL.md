---
name: firebase-basics
description: >-
  Provides foundational setup, authentication, and project management workflows
  for Firebase using the Firebase CLI. Use when checking Firebase CLI version,
  initializing a Firebase environment, authenticating, setting active projects,
  or setting up google-services.json and GoogleService-Info.plist files.
---

# Prerequisites

Complete these setup steps before proceeding:

1. **Local Environment Setup**
   - Run `npx -y firebase-tools@latest --version` to verify the Firebase CLI.
   - Verify whether the Firebase MCP server is available through the current tool environment.
   - Read [references/local-env-setup.md](references/local-env-setup.md) before configuring agent extensions.
   - Use the setup reference appropriate to the current environment:
     - [Antigravity](references/setup/antigravity.md)
     - [Android Studio](references/setup/android_studio.md)
     - [Claude Code](references/setup/claude_code.md)
     - [Cursor](references/setup/cursor.md)
     - [GitHub Copilot](references/setup/github_copilot.md)
     - [Other agents](references/setup/other_agents.md)

2. **Authentication**
   Run `npx -y firebase-tools@latest login`. For remote shells without a local browser, use:

   ```bash
   npx -y firebase-tools@latest login --no-localhost
   ```

3. **Active Project**
   Before changing project configuration, confirm whether the developer wants to use an existing Firebase project or create a new one.

   Existing project:

   ```bash
   npx -y firebase-tools@latest use <PROJECT_ID>
   ```

   New project:

   ```bash
   npx -y firebase-tools@latest projects:create <project-id> --display-name "<display-name>"
   ```

# Firebase Usage Principles

1. Use `npx -y firebase-tools@latest` for Firebase CLI commands so the version is explicit.
2. Prefer official Firebase documentation and connected Firebase tooling for current behavior.
3. Review the relevant skill or reference before changing security rules, hosting, authentication, Firestore, or Data Connect configuration.
4. Use Firebase MCP tools for supported remote operations rather than manually reproducing provider API calls.
5. Keep local agent references current using the refresh guide appropriate to the active environment.
6. Retrieve mobile application configuration with the Firebase CLI when possible:

   Android:

   ```bash
   npx -y firebase-tools@latest apps:sdkconfig ANDROID <APP_ID> --project <PROJECT_ID>
   ```

   iOS:

   ```bash
   npx -y firebase-tools@latest apps:sdkconfig IOS <APP_ID> --project <PROJECT_ID>
   ```

# References

- [Initialize Firebase](references/firebase-service-init.md)
- [Firebase CLI guide](references/firebase-cli-guide.md)
- [Web SDK setup](references/web_setup.md)
- [Android SDK setup](references/android_setup.md)
- [iOS SDK setup](references/ios_setup.md)

# Common Issues

- When browser login fails, use `npx -y firebase-tools@latest login --no-localhost`.
- For Genkit-specific work, install and review the appropriate Genkit skills separately.
