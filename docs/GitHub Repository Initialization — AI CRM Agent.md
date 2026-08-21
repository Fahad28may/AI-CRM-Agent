# GitHub Repository Initialization

Use the following GitHub repository for this project:

```bash
https://github.com/Fahad28may/AI-CRM-Agent.git
```

The target branch is:

```text
main
```

## Initial Repository Setup

When starting the project, inspect the current Git state first.

If the directory is not already a Git repository:

```bash
git init
```

Then configure the GitHub remote:

```bash
git remote add origin https://github.com/Fahad28may/AI-CRM-Agent.git
```

Set the primary branch to `main`:

```bash
git branch -M main
```

Before the first push:

1. Make sure `.gitignore` exists.
2. Make sure `.env`, credentials, API keys, OAuth tokens, private keys, and other secrets are excluded.
3. Review the files that will be committed.
4. Run the relevant tests and checks.
5. Create the initial commit.
6. Push the repository to GitHub using:

```bash
git push -u origin main
```

## Existing Remote Handling

Before running `git remote add origin`, check whether a remote already exists:

```bash
git remote -v
```

If `origin` already points to:

```text
https://github.com/Fahad28may/AI-CRM-Agent.git
```

continue using it.

Do not add a duplicate `origin`.

If `origin` points to a different repository, **do not overwrite it automatically**. Stop and inform me before changing the remote.

## Initial Push

The intended initial setup is:

```bash
git init
git remote add origin https://github.com/Fahad28may/AI-CRM-Agent.git
git branch -M main
git add <appropriate files>
git commit -m "chore: initialize AI CRM Agent"
git push -u origin main
```

Do not blindly use `git add .` if there is a possibility of accidentally committing secrets, unrelated files, generated files, or existing user work.

## Important

The repository URL above is explicitly authorized for this project.

Claude Code should **not ask me for the repository URL again** unless the Git configuration creates a conflict or the repository cannot be accessed.

After the initial push succeeds, continue using the GitHub workflow defined in the rest of this prompt:

```text
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
NEXT FEATURE
```

Every meaningful development milestone should result in a clean commit pushed to:

```text
origin/main
```

Never use force-pushes or destructive Git commands unless I explicitly authorize them.