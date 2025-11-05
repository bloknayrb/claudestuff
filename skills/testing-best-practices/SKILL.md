---
name: testing-best-practices
description: Comprehensive testing strategies and best practices for software development
version: 1.0.0
tags: [testing, quality-assurance, tdd, unit-tests]
---

# Testing Best Practices Skill

This skill provides expert knowledge on software testing methodologies, patterns, and best practices.

## Core Principles

### 1. Test Pyramid
- **Unit Tests (70%)**: Fast, isolated tests for individual functions/methods
- **Integration Tests (20%)**: Test interaction between components
- **E2E Tests (10%)**: Full application flow tests

### 2. Test Characteristics (F.I.R.S.T.)
- **Fast**: Tests should run quickly
- **Independent**: Tests shouldn't depend on each other
- **Repeatable**: Same results every time
- **Self-validating**: Clear pass/fail without manual verification
- **Timely**: Written alongside or before production code (TDD)

## Testing Patterns

### Arrange-Act-Assert (AAA)

```python
def test_user_registration():
    # Arrange: Set up test data and dependencies
    user_data = {"email": "test@example.com", "password": "secure123"}
    user_service = UserService()

    # Act: Execute the behavior being tested
    result = user_service.register(user_data)

    # Assert: Verify the outcome
    assert result.success is True
    assert result.user.email == "test@example.com"
```

### Test Doubles

**Mocks**: Verify interactions
```python
mock_email_service = Mock()
user_service.register(user_data)
mock_email_service.send_welcome_email.assert_called_once()
```

**Stubs**: Provide predetermined responses
```python
stub_database = StubDatabase()
stub_database.get_user.returns(None)  # Simulate user not found
```

**Fakes**: Working implementations with shortcuts
```python
fake_cache = InMemoryCache()  # Instead of Redis for testing
```

## Best Practices

### 1. Descriptive Test Names
```python
# Good: Describes what and why
def test_registration_fails_when_email_already_exists():
    pass

# Bad: Generic, unclear
def test_registration():
    pass
```

### 2. One Assertion Per Test (When Possible)
```python
# Good: Focused test
def test_user_email_is_stored_lowercase():
    user = User(email="Test@Example.COM")
    assert user.email == "test@example.com"

def test_user_email_is_validated():
    with pytest.raises(ValueError):
        User(email="invalid-email")
```

### 3. Avoid Test Interdependence
```python
# Bad: Tests depend on execution order
def test_create_user():
    global created_user
    created_user = User.create(...)

def test_update_user():
    created_user.update(...)  # Depends on previous test

# Good: Each test is independent
def test_update_user():
    user = User.create(...)  # Create locally
    user.update(...)
```

### 4. Use Fixtures for Setup/Teardown
```python
@pytest.fixture
def authenticated_user():
    user = User.create(email="test@example.com")
    user.login()
    yield user
    user.delete()  # Cleanup

def test_user_can_access_dashboard(authenticated_user):
    response = authenticated_user.get_dashboard()
    assert response.status_code == 200
```

### 5. Test Edge Cases
- Empty inputs
- Null/None values
- Boundary conditions
- Invalid data
- Concurrent operations
- Error conditions

## Coverage Guidelines

- Aim for 80%+ code coverage
- 100% coverage for critical paths
- Focus on behavior coverage, not just line coverage
- Don't sacrifice test quality for coverage metrics

## Common Anti-Patterns to Avoid

1. **Testing implementation details** - Test behavior, not internals
2. **Fragile tests** - Avoid coupling to UI elements or data structures
3. **Slow tests** - Optimize for speed, use test doubles
4. **Ignored/skipped tests** - Fix or delete, don't accumulate technical debt
5. **Testing frameworks instead of code** - Don't test library behavior

## Usage Instructions

When this skill is active:
- Write comprehensive tests following the AAA pattern
- Suggest appropriate test types (unit, integration, E2E)
- Identify edge cases that need coverage
- Recommend test doubles when appropriate
- Ensure tests are fast, isolated, and maintainable
