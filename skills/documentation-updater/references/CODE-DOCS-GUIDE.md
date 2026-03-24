# Code Documentation Conventions

This reference provides per-language guidance for generating and auditing inline code documentation (docstrings, doc comments, JSDoc). Scoped to the five languages where this skill generates documentation stubs. Read only the section matching the detected archetype.

For languages not covered here (Ruby/YARD, Elixir/ExDoc, C#/XML docs, PHP/PHPDoc, Swift/DocC), the skill flags undocumented public APIs in the audit report but does not generate stubs.

---

## Python

### Default: Google-Style Docstrings

```python
def fetch_user(user_id: int, include_roles: bool = False) -> User:
    """Fetch a user by their database ID.

    Queries the user table and optionally eager-loads role assignments
    to avoid N+1 queries when checking permissions.

    Args:
        user_id: The unique identifier for the user.
        include_roles: If True, eagerly load the user's role
            assignments. Defaults to False.

    Returns:
        The matching User object with all fields populated.

    Raises:
        UserNotFoundError: If no user exists with the given ID.
        DatabaseConnectionError: If the database is unreachable.

    Example:
        >>> user = fetch_user(42, include_roles=True)
        >>> print(user.roles)
        ['admin', 'editor']
    """
```

### NumPy Style (for data science projects)

Use when the codebase already follows NumPy conventions or when functions have complex parameter descriptions:

```python
def train_model(X, y, epochs=100, learning_rate=0.01):
    """Train a binary classifier on the provided dataset.

    Parameters
    ----------
    X : array-like of shape (n_samples, n_features)
        Training feature matrix.
    y : array-like of shape (n_samples,)
        Target labels (0 or 1).
    epochs : int, default=100
        Number of training iterations.
    learning_rate : float, default=0.01
        Step size for gradient descent.

    Returns
    -------
    model : TrainedModel
        The fitted model object.
    history : dict
        Training metrics per epoch with keys 'loss' and 'accuracy'.
    """
```

### Type Hints vs Docstring Types

If the codebase uses type annotations (Python 3.5+), don't duplicate types in docstrings. The docstring should describe semantics:

Bad (redundant types):
```python
def get_name(user_id: int) -> str:
    """Get the name.

    Args:
        user_id (int): The user ID.

    Returns:
        str: The name.
    """
```

Good (semantics only):
```python
def get_name(user_id: int) -> str:
    """Look up the display name for a user.

    Args:
        user_id: The user's database primary key.

    Returns:
        The user's display name, or "Unknown" if the user
        has not set one.
    """
```

### What to Document

- All public functions, classes, and methods (no leading underscore)
- Module-level docstrings: first thing in the file, describes the module's purpose
- Class docstrings: describe the class's role and any important usage patterns
- Skip `_private` methods unless the logic is non-obvious or the method is called from outside the module

---

## JavaScript / TypeScript

### JSDoc Format

```javascript
/**
 * Fetch a user by their database ID.
 *
 * Queries the user table and returns the full user object.
 * Throws if the user doesn't exist rather than returning null.
 *
 * @param {number} userId - The unique identifier for the user.
 * @param {Object} [options] - Optional configuration.
 * @param {boolean} [options.includeRoles=false] - Eagerly load roles.
 * @returns {Promise<User>} The matching user object.
 * @throws {UserNotFoundError} If no user exists with the given ID.
 * @example
 * const user = await fetchUser(42);
 * console.log(user.name); // "Alice"
 *
 * @example
 * // With roles
 * const user = await fetchUser(42, { includeRoles: true });
 * console.log(user.roles); // ["admin"]
 */
async function fetchUser(userId, options = {}) {
```

### TypeScript Consideration

When TypeScript types are present, JSDoc type annotations are redundant. Keep descriptions, drop types:

```typescript
/**
 * Fetch a user by their database ID.
 *
 * @param userId - The user's database primary key.
 * @param options - Optional configuration.
 * @param options.includeRoles - Eagerly load role assignments.
 * @returns The matching user object.
 * @throws {UserNotFoundError} If no user exists with the given ID.
 */
async function fetchUser(
  userId: number,
  options: FetchUserOptions = {}
): Promise<User> {
```

### What to Document

- All exported functions, classes, interfaces, and type aliases
- Complex type definitions that aren't self-explanatory
- Skip internal/unexported helpers unless they're called from multiple files

---

## Go

### Package Comments

Every package should have a comment. Place it immediately above the `package` declaration in the package's primary file (usually the file matching the package name, or `doc.go` for larger packages).

```go
// Package auth provides JWT-based authentication middleware
// for HTTP handlers. It supports both access and refresh tokens
// with configurable expiration and signing algorithms.
package auth
```

### Function and Type Comments

Must start with the name of the thing being documented:

```go
// FetchUser retrieves a user by their database ID. It returns
// a UserNotFoundError if no record matches the given ID.
//
// FetchUser is safe for concurrent use.
func FetchUser(ctx context.Context, id int64) (*User, error) {
```

```go
// User represents an authenticated user in the system.
// The Roles field is only populated when fetched with
// the WithRoles option.
type User struct {
    ID    int64
    Name  string
    Roles []string
}
```

### Example Functions

Functions named `ExampleXxx` in `_test.go` files appear in pkg.go.dev documentation:

```go
func ExampleFetchUser() {
    user, err := auth.FetchUser(context.Background(), 42)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(user.Name)
    // Output: Alice
}
```

### What to Document

- All exported identifiers (capitalized names): functions, types, methods, constants, variables
- Package-level documentation on every package
- Unexported identifiers only if the logic is complex or non-obvious

---

## Rust

### Doc Comments

Use `///` for item-level documentation, `//!` for module/crate-level:

```rust
/// Fetch a user by their database ID.
///
/// Queries the user table and returns the full user record.
/// Returns an error if no user matches the given ID.
///
/// # Arguments
///
/// * `user_id` - The unique database identifier for the user
/// * `include_roles` - Whether to eagerly load role assignments
///
/// # Returns
///
/// The matching [`User`] if found.
///
/// # Errors
///
/// Returns [`Error::UserNotFound`] if no user exists with the given ID.
/// Returns [`Error::Database`] if the connection pool is exhausted.
///
/// # Examples
///
/// ```
/// # use mylib::{fetch_user, Error};
/// # fn main() -> Result<(), Error> {
/// let user = fetch_user(42, false)?;
/// assert_eq!(user.name, "Alice");
/// # Ok(())
/// # }
/// ```
pub fn fetch_user(user_id: u64, include_roles: bool) -> Result<User, Error> {
```

### Important: Doc-Test Compilation

Code examples in `///` comments are compiled and run by `cargo test --doc`. They must compile. Use `# ` prefix to hide setup lines from rendered docs while keeping them in the compiled test.

### Module-Level Docs

Use `//!` at the top of `lib.rs` or module files:

```rust
//! # Auth
//!
//! JWT-based authentication middleware for HTTP handlers.
//!
//! This crate provides middleware for validating JWT tokens
//! and extracting user identity from requests.
```

### What to Document

- All `pub` items: functions, structs, enums, traits, type aliases, constants
- Crate-level docs in `lib.rs` (this becomes the crate's front page on docs.rs)
- Module-level docs for each module with `//!`
- Feature-gated items should note which feature enables them

---

## Java

### Javadoc Format

```java
/**
 * Fetch a user by their database ID.
 *
 * <p>Queries the user table and returns the full user object.
 * The returned user includes all basic fields; role assignments
 * are loaded lazily unless {@code includeRoles} is true.</p>
 *
 * @param userId the unique database identifier for the user
 * @param includeRoles if {@code true}, eagerly load role assignments
 * @return the matching user object, never {@code null}
 * @throws UserNotFoundException if no user exists with the given ID
 * @throws DatabaseException if the connection pool is exhausted
 * @see UserRepository#findById(long)
 * @since 2.0
 */
public User fetchUser(long userId, boolean includeRoles) {
```

### Package-Level Docs

Create `package-info.java` in each package directory:

```java
/**
 * Provides JWT-based authentication and authorization services.
 *
 * <p>The main entry point is {@link AuthService}, which validates
 * tokens and resolves user identity.</p>
 */
package com.example.auth;
```

### What to Document

- All `public` and `protected` methods and classes
- Package-level docs via `package-info.java`
- `@since` tags for library authors to track when APIs were introduced
- `private` methods only if the logic is complex or surprising

---

## Universal Anti-Patterns

These apply across all languages.

### Don't document the obvious

Bad:
```python
def get_name(self) -> str:
    """Get the name."""
    return self.name
```

Simple getters, setters, and trivially obvious methods don't need documentation. The signature says everything.

### Don't restate the signature

Bad: "This function takes a user ID as an integer and returns a User object."
The signature already says that. Instead, explain why, when, or edge cases.

### DO document these things

- **Why this exists** — the motivation, not just the mechanics
- **Edge cases** — what happens with null, zero, empty, or boundary inputs
- **Error conditions** — when and why errors are thrown, and what the caller should do
- **Side effects** — if the function sends network requests, writes files, modifies global state, or logs
- **Thread safety** — whether concurrent calls are safe
- **Performance characteristics** — if there are important complexity implications (O(n²) on large inputs, makes network calls, allocates significantly)
- **Preconditions** — what must be true before calling (e.g., "the connection must be open")

---

## Deferred Languages

The following languages have well-defined documentation systems. This skill will flag undocumented public APIs in the audit report but will not generate stubs for them:

- **Ruby**: YARD (`@param`, `@return`, `@example`)
- **Elixir**: ExDoc (`@doc`, `@moduledoc`, `@spec`)
- **C# / F#**: XML documentation comments (`<summary>`, `<param>`, `<returns>`)
- **PHP**: PHPDoc (`@param`, `@return`, `@throws`)
- **Swift**: DocC (`/// Description`, `- Parameters:`, `- Returns:`)

For these languages, the audit report will note the documentation gap and the expected convention, but the contributor should write the actual docstrings using their language's tooling.
