---
name: example-skill
description: An example skill demonstrating knowledge packaging
version: 1.0.0
---

# Example Skill

This is an example skill that demonstrates how to package specialized knowledge and capabilities.

## Skill Purpose

This skill provides guidance on writing clean, maintainable Python code following PEP 8 standards.

## Knowledge Base

### Code Style Guidelines

1. **Naming Conventions:**
   - Use `snake_case` for functions and variables
   - Use `PascalCase` for class names
   - Use `UPPER_CASE` for constants

2. **Function Design:**
   - Functions should do one thing well
   - Keep functions under 50 lines when possible
   - Use descriptive names that indicate purpose

3. **Documentation:**
   - Use docstrings for all public functions and classes
   - Include type hints for function parameters and returns
   - Add inline comments for complex logic

### Common Patterns

```python
# Good: Clear, single responsibility
def calculate_total_price(items: list[dict]) -> float:
    """Calculate the total price of items including tax."""
    subtotal = sum(item['price'] for item in items)
    tax = subtotal * 0.08
    return subtotal + tax

# Bad: Multiple responsibilities, unclear name
def process(data):
    total = 0
    for item in data:
        total += item['price']
    tax = total * 0.08
    print(f"Total: {total + tax}")
    return total + tax
```

## Usage Instructions

When this skill is active, apply these principles when:
- Writing new Python code
- Reviewing existing code
- Refactoring code for better quality
- Providing code examples in responses
