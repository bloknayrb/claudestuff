# Security Policy

This document describes security considerations for the claudestuff plugin marketplace.

## Understanding the Security Model

### What Plugins Can Access

When you install a plugin from this marketplace, you're granting it the same permissions that Claude Code has in your environment:

| Access Type | What This Means |
|-------------|-----------------|
| **File System** | Read/write to any files Claude Code can access |
| **Command Execution** | Run bash commands, PowerShell scripts |
| **Network** | Make HTTP requests (if Claude Code allows) |
| **MCP Servers** | Connect to configured MCP servers |

**Important**: Plugins run with full Claude Code permissions. Only install plugins you trust.

### MCP Server Security

Several plugins in this marketplace integrate with MCP (Model Context Protocol) servers:

- **SimpleMem** - Local memory storage
- **OpenMemory** - Persistent memory across sessions

#### MCP Security Considerations

1. **Local vs Remote**: All MCP servers in this marketplace are configured for local operation
2. **Data Storage**: MCP servers store data locally (typically in `~/.cache/` or configured directories)
3. **No External Transmission**: No data is sent to external services unless you explicitly configure it
4. **Server Access**: MCP servers run locally and are only accessible to Claude Code

### Data Handling

#### What Data Do Plugins Process?

| Plugin | Data Accessed | Storage |
|--------|---------------|---------|
| **transaction-analysis** | Excel files with transaction data | Analysis results in Obsidian vault |
| **obsidian-vault-management** | Obsidian vault files (markdown) | State files in vault |
| **simplemem-memory** | Conversation context | Local SQLite database |
| **ms-office-suite** | Office documents | Processed files in working directory |
| **professional-agents** | Task context | No persistent storage |
| **automation** | Vault files, state files | Updates to vault files |

#### Sensitive Data Considerations

- **Do not** store credentials, API keys, or passwords in files processed by plugins
- **Do not** process confidential documents without understanding data flow
- State files (like `Claude-State-Tracking.md`) may contain task summaries

### Agent Permission Model

Agents defined in plugins operate within Claude Code's permission system:

1. **Tool Access**: Agents can use any tool Claude Code has access to
2. **No Privilege Escalation**: Agents cannot access more than Claude Code itself
3. **Audit Trail**: All agent actions appear in the Claude Code session output
4. **User Approval**: Sensitive operations may prompt for confirmation depending on your Claude Code settings

## Reporting Security Issues

### Responsible Disclosure Process

If you discover a security vulnerability in this marketplace:

1. **Do Not** open a public GitHub issue
2. **Email** the maintainer directly (or use GitHub's private vulnerability reporting)
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### What Qualifies as a Security Issue

**Yes, report these:**
- Plugin code that exfiltrates data unexpectedly
- Command injection vulnerabilities
- Insecure default configurations
- Credential exposure in logs or state files
- MCP server misconfiguration allowing unauthorized access

**Not security issues (but still bugs):**
- Plugin fails to handle malformed input gracefully
- Error messages expose file paths
- Plugin requires more permissions than documented

### Response Timeline

This is a personal showcase, not a commercial product. Response times reflect that:

- **Acknowledgment**: Within 1 week
- **Assessment**: Within 2 weeks
- **Fix (if applicable)**: Best effort, depends on severity

## Best Practices for Users

### Before Installing Plugins

1. **Review the source code** - All plugins are open source; read what they do
2. **Check the README** - Understand what access the plugin needs
3. **Test in isolation** - Try plugins on non-sensitive data first

### Runtime Precautions

1. **Monitor Claude Code output** - Watch for unexpected file access or commands
2. **Use minimal permissions** - Configure Claude Code with appropriate sandboxing
3. **Keep backups** - Plugins can modify files; maintain vault backups

### MCP Server Security

1. **Local only** - Don't expose MCP servers to network
2. **Regular cleanup** - Periodically review stored memories
3. **Understand retention** - Know how long data is kept

## Version History

| Date | Change |
|------|--------|
| 2026-01-22 | Initial security policy |
