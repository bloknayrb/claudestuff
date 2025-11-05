---
name: skill-creation
description: Expert guidance for creating efficient, comprehensive, and well-structured Claude Code skills following best practices and progressive disclosure principles
version: 1.0.0
tags: [meta, skill-authoring, documentation, best-practices]
---

# Skill Creation Expert

This skill provides comprehensive guidance for creating high-quality Claude Code skills that are efficient, discoverable, and maintainable.

## Core Principles

### 1. Progressive Disclosure
Progressive disclosure is the most important design principle for skills. Like a well-organized manual, skills should reveal information incrementally:

**Three Levels of Information Loading:**

1. **Metadata Level** (Always loaded): Name and description from YAML frontmatter
   - Loaded into system prompt at startup
   - Determines when Claude invokes the skill
   - Must be clear, specific, and action-oriented

2. **SKILL.md Body** (Loaded when skill is activated): Core instructions and guidance
   - Keep under 500 lines for optimal performance
   - Include essential procedural knowledge
   - Reference additional resources rather than including everything

3. **Additional Resources** (Loaded on-demand): Detailed documentation
   - `references/` - Extended documentation, specs, examples
   - `scripts/` - Executable tools and utilities
   - `assets/` - Templates, configuration files, binary resources

### 2. Discoverability
The name and description determine when Claude will use your skill.

**Name Requirements:**
- Lowercase alphanumeric characters and hyphens only
- Maximum 64 characters
- Must match the containing directory name
- Use hyphen-case: `api-design`, not `ApiDesign` or `api_design`
- Be specific: `react-testing` not just `testing`

**Description Best Practices:**
- Maximum 1024 characters
- Use third-person form: "This skill should be used when..." not "Use this skill when..."
- Be specific about capabilities and use cases
- Include trigger words that Claude will recognize
- Avoid vague descriptions like "helps with coding"

**Examples:**

```markdown
Good:
description: RESTful API design principles including resource-oriented design, HTTP methods, status codes, versioning, pagination, and security best practices

Bad:
description: Helps with API development
```

### 3. Content Organization

**Required Structure:**
```
skill-name/
├── SKILL.md              # Required: Core instructions
├── scripts/              # Optional: Executable scripts
├── references/           # Optional: Extended documentation
└── assets/               # Optional: Templates and resources
```

## SKILL.md File Structure

### Frontmatter Template

```yaml
---
name: skill-name
description: Specific description of what this skill does and when to use it
version: 1.0.0                    # Optional but recommended
tags: [tag1, tag2, tag3]          # Optional but helpful
license: MIT                      # Optional
---
```

**Optional Frontmatter Fields:**
- `version`: Semantic versioning (1.0.0)
- `tags`: Array of relevant keywords for organization
- `license`: Brief license identifier (MIT, Apache-2.0, etc.)
- `allowed-tools`: List of pre-approved tools (Claude Code specific)
- `metadata`: Key-value pairs for client-specific properties

### Content Template

```markdown
# Skill Title

[1-2 sentence overview of what this skill provides]

## Core Principles

### 1. First Major Concept
[Explanation with examples]

### 2. Second Major Concept
[Explanation with examples]

## [Domain-Specific Sections]

[Organize by logical groupings relevant to your skill's domain]

### Pattern Examples

[Show good vs. bad patterns with code examples]

## Best Practices

1. **Practice Name**: Description
2. **Practice Name**: Description

## Common Anti-Patterns

1. **Anti-pattern Name**: Why to avoid and alternative
2. **Anti-pattern Name**: Why to avoid and alternative

## Usage Instructions

When this skill is active:
- Action Claude should take
- Consideration Claude should apply
- Output format Claude should follow
```

## Writing Guidelines

### Language and Tone

**Do:**
- Use imperative/infinitive form: "Apply these principles", "Check for errors"
- Be objective and instructional
- Use third-person in descriptions: "This skill should be used when..."
- Focus on procedural knowledge and non-obvious domain expertise
- Include specific, actionable guidance

**Don't:**
- Use second person: "You should..." (in SKILL.md body)
- Include obvious information Claude already knows
- Repeat general programming knowledge
- Use conversational tone

### Code Examples

**Always Include:**
- Contrasting examples (Good vs. Bad, Before vs. After)
- Real-world scenarios
- Complete, runnable code snippets
- Comments explaining key points
- Multiple languages if applicable

**Example Format:**
```python
# Vulnerable: SQL Injection
query = f"SELECT * FROM users WHERE id = {user_id}"

# Secure: Parameterized query
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_id,))
```

### Section Organization

**Prioritize Information by:**
1. Frequency of use (most common scenarios first)
2. Foundational concepts before advanced topics
3. Practical examples before theoretical explanations
4. Critical information before nice-to-have details

**Keep SKILL.md Lean:**
- If a section exceeds 100 lines, consider moving to `references/`
- If information is rarely needed, put it in a separate reference file
- If contexts are mutually exclusive, separate them into different files

## Progressive Disclosure Strategies

### Strategy 1: Reference Files

When SKILL.md exceeds 500 lines, split content into reference files:

```markdown
## Advanced Configuration

For detailed configuration options, see `references/advanced-config.md`.

For environment-specific setups:
- AWS: `references/aws-setup.md`
- Azure: `references/azure-setup.md`
- GCP: `references/gcp-setup.md`
```

### Strategy 2: Scripts for Complex Operations

Move complex operations to scripts:

```markdown
## Database Migration

Run the migration script to set up the database:

```bash
python scripts/migrate.py --environment production
```

See `scripts/migrate.py` for migration logic and options.
```

### Strategy 3: Assets for Reusable Templates

Store templates in assets directory:

```markdown
## Creating a New Component

Use the component template from `assets/component-template.tsx` as a starting point.

The template includes:
- TypeScript type definitions
- Props interface
- Default export
- Basic styling structure
```

## Validation Checklist

Before finalizing your skill, verify:

**Frontmatter:**
- [ ] `name` matches directory name exactly
- [ ] `name` uses only lowercase, numbers, and hyphens
- [ ] `name` is under 64 characters
- [ ] `description` is specific and action-oriented
- [ ] `description` is under 1024 characters
- [ ] `description` uses third-person form
- [ ] Optional fields (version, tags, license) are valid

**Content:**
- [ ] SKILL.md body is under 500 lines
- [ ] Includes clear usage instructions
- [ ] Contains specific, actionable guidance
- [ ] Code examples are complete and correct
- [ ] Sections are logically organized
- [ ] No obvious or redundant information
- [ ] References to external files are accurate

**Structure:**
- [ ] Directory name matches skill name
- [ ] SKILL.md exists and is valid
- [ ] Referenced files in `scripts/` exist and are executable
- [ ] Referenced files in `references/` exist
- [ ] Referenced files in `assets/` exist

## Common Mistakes to Avoid

### 1. Vague Descriptions
```yaml
# Bad
description: Helps with Python coding

# Good
description: Python code quality guidelines including PEP 8 style, type hints, error handling, and common anti-patterns to avoid
```

### 2. Including Obvious Information
```markdown
# Bad (Claude already knows this)
## Variables
Variables store data in your program.

# Good (Specific domain knowledge)
## Variable Naming in API Context
Use resource-oriented names for API response variables:
- `user` or `users` not `response` or `data`
- `error` not `err` or `e` for better logging
```

### 3. No Usage Instructions
```markdown
# Bad
[Skill ends without guidance on when/how to apply it]

# Good
## Usage Instructions

When this skill is active:
- Apply PEP 8 style guidelines to all Python code
- Add type hints to function signatures
- Use context managers for resource management
- Suggest refactoring when functions exceed 50 lines
```

### 4. Monolithic SKILL.md
```markdown
# Bad: 1500 lines in SKILL.md with everything

# Good: 400 lines in SKILL.md + references
## Advanced Topics

For comprehensive coverage of advanced patterns:
- Microservices architecture: `references/microservices.md`
- Event-driven systems: `references/event-driven.md`
- CQRS pattern: `references/cqrs.md`
```

## Skill Categories and Examples

### Technical Skills
- **Testing frameworks**: Jest patterns, pytest best practices
- **Language-specific**: Python style, Go conventions, Rust patterns
- **Architecture**: Microservices, event-driven, CQRS
- **Protocols**: GraphQL design, gRPC patterns, REST principles

### Domain Skills
- **Security**: OWASP guidelines, secure coding, penetration testing
- **Performance**: Optimization techniques, profiling, caching strategies
- **Accessibility**: WCAG compliance, ARIA patterns, screen reader support
- **Data**: SQL optimization, NoSQL patterns, data modeling

### Process Skills
- **Documentation**: API docs, README standards, changelog formats
- **Testing**: TDD workflows, test patterns, coverage strategies
- **Deployment**: CI/CD patterns, infrastructure as code, rollback strategies
- **Code review**: Review checklists, feedback patterns, quality gates

### Meta Skills
- **Skill creation**: This skill
- **Template generation**: Creating boilerplate
- **Workflow automation**: Task patterns, efficiency techniques

## Testing Your Skill

### 1. Clarity Test
- Can another developer understand when to use this skill from the description?
- Are the instructions clear enough to follow without context?

### 2. Specificity Test
- Does the skill provide non-obvious domain knowledge?
- Would Claude benefit from this information being explicit?

### 3. Size Test
- Is SKILL.md under 500 lines?
- Have large sections been moved to references?

### 4. Completeness Test
- Are all referenced files included?
- Do code examples work as written?
- Are there usage instructions?

### 5. Discoverability Test
- Does the description include trigger words for relevant use cases?
- Is the name specific enough to be discoverable?

## Example: Well-Structured Skill

```markdown
---
name: graphql-api-design
description: GraphQL API design patterns including schema design, resolver optimization, error handling, authentication, and N+1 query prevention
version: 1.0.0
tags: [graphql, api, design, performance]
---

# GraphQL API Design Skill

This skill provides expert guidance on designing performant, maintainable GraphQL APIs.

## Schema Design Principles

### 1. Type System Best Practices

**Use Specific Types:**
```graphql
# Good: Specific, self-documenting
type User {
  id: ID!
  email: EmailAddress!
  createdAt: DateTime!
  role: UserRole!
}

enum UserRole {
  ADMIN
  MODERATOR
  USER
}

# Bad: Vague, using strings for everything
type User {
  id: String
  email: String
  createdAt: String
  role: String
}
```

### 2. Resolver Optimization

**Prevent N+1 Queries:**

Use DataLoader to batch requests:

```javascript
// See references/dataloader-patterns.md for complete examples

const userLoader = new DataLoader(async (userIds) => {
  const users = await db.users.findMany({ where: { id: { in: userIds } } })
  return userIds.map(id => users.find(u => u.id === id))
})
```

## Advanced Topics

For detailed coverage of specific scenarios:
- Schema evolution and versioning: `references/schema-evolution.md`
- Subscription patterns: `references/subscriptions.md`
- Federation architecture: `references/federation.md`

## Usage Instructions

When this skill is active:
- Design schemas with strong typing and null safety
- Implement DataLoader for N+1 query prevention
- Use proper error handling with GraphQL error extensions
- Apply authentication at the resolver level
- Validate inputs using schema directives or middleware
```

## Usage Instructions

When this skill is active:

1. **For New Skills:**
   - Start with clear frontmatter (name, description, version, tags)
   - Organize content following the template structure
   - Keep SKILL.md under 500 lines using progressive disclosure
   - Include specific, actionable guidance with code examples
   - End with clear usage instructions

2. **For Reviewing Skills:**
   - Verify frontmatter follows validation rules
   - Check that description is specific and third-person
   - Ensure SKILL.md is under 500 lines
   - Confirm all referenced files exist
   - Validate code examples are complete and correct

3. **For Refactoring Skills:**
   - Identify sections that can move to `references/`
   - Extract complex operations into `scripts/`
   - Move templates and configs to `assets/`
   - Ensure progressive disclosure is properly implemented
   - Update description if capabilities have changed

4. **Output Format:**
   - Always include complete, valid YAML frontmatter
   - Use proper markdown formatting with clear headers
   - Include contrasting code examples (good vs. bad)
   - End with "Usage Instructions" section
   - Reference external files when content is extensive
