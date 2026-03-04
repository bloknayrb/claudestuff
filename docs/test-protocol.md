# Plugin Test Protocol

This document describes how to verify plugins work correctly before submitting changes or creating releases.

## Pre-Merge Checklist (Contributors)

Before submitting a pull request, verify your changes work:

### 1. Fresh Session Test

```bash
# Start Claude Code without any plugins loaded
claude --no-plugins

# Verify you're starting fresh
/plugin list
# Should show: No plugins installed
```

### 2. Add Marketplace from Local Fork

```bash
# Add your local fork as a marketplace
/plugin marketplace add /path/to/your/claudestuff

# Verify marketplace is added
/plugin marketplace list
```

### 3. Install the Plugin

```bash
# Install the plugin you modified
/plugin install [plugin-name]

# Example:
/plugin install automation
```

### 4. Verify Discovery

**For Commands:**
```bash
/help
# Your command should appear in the list
```

**For Agents:**
- Agents appear in the Task tool's available agents
- Check the system prompt includes your agent

**For Skills:**
- Skills are auto-detected when context is relevant
- Try a query that should trigger the skill

### 5. Basic Execution Test

**Commands:**
```bash
# Run the primary command
/[command-name]
```

**Expected outcomes:**
- Command executes without import errors
- Any expected errors (missing dependencies, vault structure) are documented
- Output matches what README describes

### 6. Document Expected Errors

Some plugins require specific setup. If your plugin fails gracefully without this setup, that's acceptable - but **document it**.

Example acceptable error:
```
Error: Could not find Claude-State-Tracking.md
This plugin requires a specific Obsidian vault structure.
See README for setup instructions.
```

---

## Pre-Release Checklist (Maintainer)

Before creating a release, verify all plugins work together:

### 1. Full Plugin Test

Run the contributor checklist for **every plugin**:

| Plugin | Installs | Primary Command | Notes |
|--------|----------|-----------------|-------|
| example-plugin | ✓ | `/hello` works | |
| automation | ✓ | `/track` needs vault | Expected |
| ms-office-suite | ✓ | Skills load | |
| obsidian-vault-management | ✓ | Skills load | CLI optional |
| professional-agents | ✓ | Agents appear | |
| simplemem-memory | ✓ | Skills load | Needs SimpleMem MCP |
| transaction-analysis | ✓ | `/analyze-transactions` | |

### 2. Cross-Plugin Compatibility

Install multiple plugins and verify no conflicts:

```bash
# Install several plugins
/plugin install example-plugin
/plugin install professional-agents
/plugin install ms-office-suite

# Verify all components load
/help
# Should show all commands

# Verify no agent conflicts
# Run a task that would invoke an agent
```

### 3. Platform Testing

| Platform | Required For | Test Status |
|----------|--------------|-------------|
| Windows | automation, obsidian-* | Required |
| macOS | All plugins | Nice to have |
| Linux | All plugins | Nice to have |

### 4. Documentation Verification

- [ ] All plugin READMEs are up-to-date
- [ ] CHANGELOG.md reflects changes
- [ ] marketplace.json versions match plugin.json versions

### 5. Release Steps

1. Update version in `marketplace.json`
2. Update CHANGELOG.md with release date
3. Create git tag: `git tag -a v0.2.0 -m "v0.2.0 release"`
4. Push tag: `git push origin v0.2.0`
5. Create GitHub release from tag

---

## Troubleshooting

### Plugin Won't Install

**Symptoms:** `/plugin install` fails

**Check:**
1. marketplace.json has the plugin listed
2. Plugin path in marketplace.json is correct
3. plugin.json exists in `.claude-plugin/` subdirectory

### Command Not Appearing

**Symptoms:** Command installed but not in `/help`

**Check:**
1. Command file has YAML frontmatter with `description`
2. Command file is in `commands/` directory
3. File extension is `.md`

### Agent Not Available

**Symptoms:** Agent not appearing in Task tool

**Check:**
1. Agent file has YAML frontmatter with `name` and `description`
2. Agent file is in `agents/` directory
3. `description` clearly states when to use the agent

### Skill Not Loading

**Symptoms:** Skill knowledge not available

**Check:**
1. Skill file is named `SKILL.md` (case-sensitive)
2. Skill is in a properly named directory under `skills/`
3. YAML frontmatter is valid

### Hook Not Firing

**Symptoms:** Hook doesn't execute on event

**Check:**
1. hooks.json is valid JSON
2. Event name is correct (PreToolUse, PostToolUse, etc.)
3. Matcher pattern matches the intended tools

### CLI-Dependent Features Not Working

**Symptoms:** Orphan detection skipped, wikilink validation using fallback

**Check:**
1. Obsidian is running
2. CLI is registered on PATH: `obsidian version` should return version info
3. If not on PATH: Obsidian Settings → General → CLI → Register
4. Vault is fully indexed (wait 60 seconds after opening Obsidian)

**Expected fallback behavior:**
- `obsidian version` fails → all agents use Glob/Grep/PowerShell (< 2 second delay)
- Orphan detection skipped with note in report
- All other checks function normally via fallback

---

## Test Output Template

Use this template when reporting test results:

```markdown
## Test Report: [Plugin Name]

**Tested on:** [Date]
**Platform:** [Windows/macOS/Linux]
**Claude Code Version:** [Version]

### Installation
- [ ] Plugin installed successfully
- [ ] No errors during installation

### Discovery
- [ ] Commands appear in /help
- [ ] Agents appear in Task tool
- [ ] Skills are detectable

### Execution
- [ ] Primary command runs
- [ ] Expected behavior matches README
- [ ] Errors are graceful and documented

### Notes
[Any issues, warnings, or observations]
```
