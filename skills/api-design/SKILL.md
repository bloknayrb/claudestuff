---
name: api-design
description: RESTful API design principles and best practices
version: 1.0.0
tags: [api, rest, http, design, architecture]
---

# API Design Best Practices Skill

This skill provides expert guidance on designing clean, intuitive, and maintainable RESTful APIs.

## Core Principles

### 1. Resource-Oriented Design
Think in terms of resources (nouns), not actions (verbs)

```
Good:
  GET    /users              # Get all users
  GET    /users/123          # Get specific user
  POST   /users              # Create new user
  PUT    /users/123          # Update user
  DELETE /users/123          # Delete user

Bad:
  GET    /getUsers
  POST   /createUser
  POST   /updateUser/123
  POST   /deleteUser/123
```

### 2. Use HTTP Methods Correctly

- **GET**: Retrieve resources (idempotent, no side effects)
- **POST**: Create new resources
- **PUT**: Replace/update entire resource (idempotent)
- **PATCH**: Partial update of resource
- **DELETE**: Remove resource (idempotent)

### 3. Proper HTTP Status Codes

**Success (2xx)**
- `200 OK`: Successful GET, PUT, PATCH, DELETE
- `201 Created`: Successful POST with new resource
- `204 No Content`: Successful request with no body

**Client Errors (4xx)**
- `400 Bad Request`: Invalid request format/data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource doesn't exist
- `422 Unprocessable Entity`: Validation errors

**Server Errors (5xx)**
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Temporary downtime

## API Structure Best Practices

### Versioning
```
Option 1: URL versioning (most common)
  /api/v1/users
  /api/v2/users

Option 2: Header versioning
  Accept: application/vnd.myapi.v1+json

Option 3: Query parameter
  /users?version=1
```

### Pagination
```json
GET /users?page=2&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Filtering and Sorting
```
GET /users?role=admin&status=active&sort=createdAt:desc
GET /products?minPrice=100&maxPrice=500&category=electronics
```

### Nested Resources
```
GET /users/123/posts          # Get posts for user 123
GET /users/123/posts/456      # Get specific post by user 123

# Avoid deep nesting (max 2 levels)
Bad: /users/123/posts/456/comments/789/likes
Good: /comments/789/likes
```

## Request/Response Design

### Request Body (JSON)
```json
POST /users
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin"
}
```

### Success Response
```json
201 Created
Location: /users/123

{
  "id": "123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin",
  "createdAt": "2025-11-05T10:30:00Z",
  "updatedAt": "2025-11-05T10:30:00Z"
}
```

### Error Response (Consistent Format)
```json
400 Bad Request

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

## Security Best Practices

### 1. Authentication & Authorization
```
Authorization: Bearer <jwt-token>
```

### 2. Rate Limiting
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1699200000
```

### 3. Input Validation
- Validate all input data
- Sanitize to prevent injection attacks
- Use allowlists over denylists
- Validate content types

### 4. HTTPS Only
- Always use HTTPS in production
- Redirect HTTP to HTTPS
- Use HSTS headers

## Naming Conventions

### Resource Names
- Use plural nouns: `/users`, `/products`, `/orders`
- Use kebab-case for multi-word resources: `/order-items`
- Be consistent across the API

### Field Names
```json
{
  "firstName": "John",        // camelCase (JavaScript/JSON common)
  "lastName": "Doe",
  "createdAt": "2025-11-05",
  "isActive": true
}
```

## Documentation Standards

### Endpoint Documentation
```
GET /users/{id}

Description: Retrieve a specific user by ID

Parameters:
  - id (path, required): User ID

Responses:
  200: User found and returned
  404: User not found
  401: Authentication required

Example Response:
{
  "id": "123",
  "email": "user@example.com",
  ...
}
```

### Use OpenAPI/Swagger
- Generate interactive documentation
- Enable API testing
- Support client code generation

## Performance Considerations

### 1. Field Selection
```
GET /users/123?fields=id,email,name
```

### 2. Caching Headers
```
Cache-Control: max-age=3600
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

### 3. Compression
```
Accept-Encoding: gzip, deflate
Content-Encoding: gzip
```

### 4. Async Operations
```
POST /reports/generate
202 Accepted
Location: /reports/status/abc123

GET /reports/status/abc123
{
  "status": "processing",
  "progress": 45
}
```

## Common Anti-Patterns

1. **Verbs in URLs**: Use HTTP methods, not URL verbs
2. **Ignoring HTTP methods**: Don't use POST for everything
3. **Inconsistent naming**: Stick to one convention
4. **Breaking changes without versioning**: Always version
5. **Exposing internal structure**: Abstract implementation details
6. **Missing error details**: Provide actionable error messages

## Usage Instructions

When this skill is active:
- Design APIs following RESTful principles
- Use appropriate HTTP methods and status codes
- Structure endpoints for clarity and consistency
- Include proper error handling and validation
- Consider security, performance, and documentation
