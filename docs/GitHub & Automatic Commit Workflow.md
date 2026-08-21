# 40. GitHub and Git Workflow

GitHub is the source-control and project-history system for this project.

Claude Code should actively manage the Git repository throughout development.

## Repository Setup

Before making substantial changes:

1. Check whether the current directory is already a Git repository.
2. Check the current branch.
3. Check the configured Git remote.
4. Check whether there are existing uncommitted changes.
5. Do NOT overwrite or discard existing user changes.
6. If a GitHub remote already exists, use it.
7. If no remote exists, stop and ask me for the repository URL rather than inventing one.

Never commit secrets, credentials, API keys, `.env` files, OAuth tokens, private keys, or other sensitive information.

Make sure `.gitignore` is configured before the first commit.

---

## Commit Strategy

Create commits at meaningful development milestones.

Do NOT create one enormous commit containing the entire application.

Do NOT create hundreds of meaningless commits for tiny changes.

Each commit should represent one coherent piece of work.

Examples:

```text
chore: initialize project structure
feat: add authentication and sessions
feat: add workspace and membership system
feat: add HubSpot OAuth integration
feat: add CRM synchronization
feat: add pipeline health analysis
feat: add AI recommendation engine
feat: add follow-up generation
feat: add approval workflow
feat: add CRM action execution
feat: add audit logging
feat: add AI activity dashboard
feat: add automation rules
test: add CRM synchronization tests
test: add authorization test coverage
security: harden tenant isolation
fix: handle HubSpot token refresh failures
fix: prevent duplicate CRM records
```

Use conventional commit messages.

---

## Before Every Commit

Before committing:

1. Check `git status`.
2. Review the changed files.
3. Inspect the diff.
4. Make sure no secrets are included.
5. Run relevant tests.
6. Run linting.
7. Run type checking where applicable.
8. Fix failures before committing.
9. Stage only the files belonging to the current change.
10. Create the commit.

Never blindly use:

```bash
git add .
```

if doing so could accidentally include unrelated files, secrets, generated files, or user changes.

---

## Commit History

Maintain a clean and understandable history.

A reviewer should be able to understand the project's development by reading:

```bash
git log
```

The history should show the evolution of the product:

```text
Initialize project
        ↓
Authentication
        ↓
Workspace architecture
        ↓
CRM integration
        ↓
CRM synchronization
        ↓
Pipeline intelligence
        ↓
AI reasoning
        ↓
Approval system
        ↓
CRM actions
        ↓
Dashboardgit remote add origin https://github.com/Fahad28may/AI-CRM-Agent.git
git branch -M main
git push -u origin main
        ↓
Automation
        ↓
Security hardening
        ↓
Testing
```

---

# 41. Automatic GitHub Pushes

After each successful meaningful commit:

1. Push the commit to the configured GitHub remote.
2. Verify that the push succeeded.
3. Continue development.

For example:

```text
Implement feature
      ↓
Run tests
      ↓
Review diff
      ↓
Commit
      ↓
Push to GitHub
      ↓
Verify push
      ↓
Continue
```

Do not wait until the entire project is finished before pushing.

---

# 42. GitHub Branch Strategy

Use a sensible branch structure.

For normal development:

```text
main
```

should contain stable code.

Use a development branch if appropriate:

```text
main
develop
```

For larger features, use feature branches:

```text
feature/hubspot-integration
feature/ai-recommendations
feature/approval-workflow
```

Do not create unnecessary branches for tiny changes.

If the repository already has an established branching strategy, inspect it and follow it instead of replacing it.

---

# 43. Git Safety Rules

NEVER execute destructive Git commands without explicit permission.

Do NOT automatically run:

```bash
git reset --hard
git clean -fd
git push --force
git push --force-with-lease
```

Do not rewrite existing commit history.

Do not delete branches automatically.

Do not overwrite existing work.

If there is a conflict between existing user changes and your implementation, stop and explain the conflict.

---

# 44. Authentication

Use the GitHub authentication already configured in the environment.

Do not ask me for or store my GitHub password or personal access token in source code.

If GitHub authentication is unavailable, tell me exactly what is missing and stop the push operation.

Do not attempt to bypass GitHub authentication.

---

# 45. Commit Frequency

Use this general rule:

**One meaningful feature or engineering milestone = one or more coherent commits.**

For example, implementing HubSpot integration might produce:

```text
feat: add CRM provider interface
feat: add HubSpot OAuth flow
feat: add HubSpot API client
feat: add CRM synchronization
test: add HubSpot integration tests
```

That is preferable to:

```text
feat: add everything
```

At the same time, don't create commits such as:

```text
fix typo
fix another typo
change variable
change another variable
```

unless those changes are genuinely independent.

---

# 46. Push Verification

After pushing, verify the repository state.

Confirm:

- commit exists locally
- commit exists on the remote
- working tree is clean where appropriate
- current branch is correct
- remote is correct

If a push fails:

1. Diagnose the error.
2. Do not force push.
3. Do not delete or rewrite commits.
4. Fix the underlying issue if it can be safely fixed.
5. Retry.
6. If credentials or permissions are required, stop and tell me.

---

# 47. Development Log

Maintain a lightweight development history in the repository.

Create:

```text
CHANGELOG.md
```

or another appropriate development log.

Record major milestones, architectural decisions, and significant changes.

Keep it concise.

Do not duplicate the entire Git history.

---

# 48. GitHub as Part of the Development Loop

Treat GitHub as part of the engineering workflow rather than merely a final backup.

The intended loop is:

```text
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
REVIEW
 ↓
COMMIT
 ↓
PUSH
 ↓
VERIFY
 ↓
NEXT TASK
```

Continue this loop throughout the project.

---

# 49. Final Repository State

When the MVP is complete:

- all code should be committed
- working tree should be clean
- latest changes should be pushed
- GitHub should contain the complete commit history
- no secrets should exist in the repository
- README should explain setup and development
- `.env.example` should document required environment variables without containing real secrets
- tests should pass
- linting should pass
- type checking should pass where applicable

Before declaring the project complete, run:

```bash
git status
```

and verify that there are no unexpected uncommitted changes.

Then verify that the latest commit has successfully reached the configured GitHub remote.

The GitHub repository should tell a clear story of how the AI CRM Agent was built.
