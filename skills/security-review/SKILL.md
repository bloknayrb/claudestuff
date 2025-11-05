---
name: security-review
description: Security vulnerability detection and secure coding practices
version: 1.0.0
tags: [security, vulnerabilities, owasp, secure-coding]
---

# Security Review Skill

This skill provides expert knowledge on identifying security vulnerabilities and implementing secure coding practices.

## OWASP Top 10 Security Risks

### 1. Injection Attacks

**SQL Injection**
```python
# Vulnerable
query = f"SELECT * FROM users WHERE email = '{user_input}'"

# Secure: Use parameterized queries
query = "SELECT * FROM users WHERE email = ?"
cursor.execute(query, (user_input,))
```

**Command Injection**
```python
# Vulnerable
os.system(f"ping {user_input}")

# Secure: Validate input and use safe APIs
import subprocess
subprocess.run(["ping", "-c", "1", validated_host], check=True)
```

**NoSQL Injection**
```javascript
// Vulnerable
db.users.find({ email: req.body.email })

// Secure: Validate input type
const email = String(req.body.email);
db.users.find({ email: email })
```

### 2. Broken Authentication

**Password Storage**
```python
# Vulnerable: Plain text or MD5
password = "user_password"

# Secure: Use bcrypt, Argon2, or PBKDF2
import bcrypt
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
```

**Session Management**
```python
# Secure session configuration
SESSION_COOKIE_SECURE = True      # HTTPS only
SESSION_COOKIE_HTTPONLY = True    # No JavaScript access
SESSION_COOKIE_SAMESITE = 'Strict'
SESSION_TIMEOUT = 30 * 60         # 30 minutes
```

### 3. Sensitive Data Exposure

**Encryption in Transit**
```python
# Always use HTTPS/TLS
# Enforce HSTS headers
response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
```

**Encryption at Rest**
```python
from cryptography.fernet import Fernet

# Encrypt sensitive data
cipher = Fernet(encryption_key)
encrypted_data = cipher.encrypt(sensitive_data.encode())

# Never log sensitive information
logger.info(f"User logged in")  # Don't log passwords, tokens, etc.
```

### 4. XML External Entities (XXE)

```python
# Vulnerable
import xml.etree.ElementTree as ET
tree = ET.parse(user_file)

# Secure: Disable external entity processing
from defusedxml import ElementTree as ET
tree = ET.parse(user_file)
```

### 5. Broken Access Control

```python
# Vulnerable: Insecure Direct Object Reference (IDOR)
@app.route('/users/<user_id>')
def get_user(user_id):
    return User.get(user_id)  # Any user can access any user_id

# Secure: Check authorization
@app.route('/users/<user_id>')
@login_required
def get_user(user_id):
    if current_user.id != user_id and not current_user.is_admin:
        abort(403)
    return User.get(user_id)
```

### 6. Security Misconfiguration

**Checklist:**
- [ ] Disable debug mode in production
- [ ] Remove default credentials
- [ ] Disable directory listing
- [ ] Remove unnecessary features/services
- [ ] Keep software updated
- [ ] Implement proper error handling (don't expose stack traces)

```python
# Development
DEBUG = True
SHOW_ERRORS = True

# Production
DEBUG = False
SHOW_ERRORS = False
ALLOWED_HOSTS = ['yourdomain.com']
```

### 7. Cross-Site Scripting (XSS)

**Stored XSS**
```python
# Vulnerable: Direct HTML output
return f"<div>Welcome, {username}</div>"

# Secure: Escape HTML
from html import escape
return f"<div>Welcome, {escape(username)}</div>"
```

**DOM-based XSS**
```javascript
// Vulnerable
element.innerHTML = userInput;

// Secure
element.textContent = userInput;
```

**Content Security Policy (CSP)**
```python
response.headers['Content-Security-Policy'] = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'"
)
```

### 8. Insecure Deserialization

```python
# Vulnerable: pickle can execute arbitrary code
import pickle
data = pickle.loads(untrusted_data)

# Secure: Use JSON for untrusted data
import json
data = json.loads(untrusted_data)
```

### 9. Using Components with Known Vulnerabilities

**Best Practices:**
```bash
# Regularly update dependencies
pip list --outdated
npm audit

# Use dependency scanning tools
pip-audit
npm audit fix

# Pin versions in production
pip freeze > requirements.txt
npm ci  # Instead of npm install
```

### 10. Insufficient Logging & Monitoring

```python
import logging

# Log security events
logger.warning(f"Failed login attempt for user: {email} from IP: {ip_address}")
logger.critical(f"Potential SQL injection detected: {suspicious_input}")

# What to log:
# - Authentication attempts (success/failure)
# - Authorization failures
# - Input validation failures
# - Application errors
# - Administrative actions

# What NOT to log:
# - Passwords, tokens, session IDs
# - Credit card numbers, PII
# - Encryption keys
```

## Input Validation

### Allowlist Approach
```python
# Vulnerable: Denylist (easily bypassed)
if '<script>' not in user_input:
    process(user_input)

# Secure: Allowlist
import re
if re.match(r'^[a-zA-Z0-9_-]+$', user_input):
    process(user_input)
else:
    raise ValueError("Invalid input")
```

### Type Validation
```python
from pydantic import BaseModel, EmailStr, constr

class UserInput(BaseModel):
    email: EmailStr
    age: int = Field(ge=0, le=150)
    username: constr(min_length=3, max_length=20, regex=r'^[a-zA-Z0-9_]+$')
```

## Cross-Site Request Forgery (CSRF)

```python
# Implement CSRF tokens
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect(app)

# For AJAX requests
@app.route('/api/data', methods=['POST'])
@csrf.exempt  # Only if using custom token validation
def api_data():
    # Validate custom CSRF token from headers
    if request.headers.get('X-CSRF-Token') != session['csrf_token']:
        abort(403)
```

## API Security

### Rate Limiting
```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=lambda: request.remote_addr)

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    pass
```

### API Authentication
```python
# Use Bearer tokens (JWT)
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# Implement token expiration
import jwt
from datetime import datetime, timedelta

token = jwt.encode({
    'user_id': user.id,
    'exp': datetime.utcnow() + timedelta(hours=1)
}, secret_key, algorithm='HS256')
```

## File Upload Security

```python
import os
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    file = request.files['file']

    # Validate file extension
    if not allowed_file(file.filename):
        abort(400)

    # Use secure filename
    filename = secure_filename(file.filename)

    # Validate file size
    if len(file.read()) > 5 * 1024 * 1024:  # 5MB
        abort(413)

    # Store outside web root
    file.save(os.path.join('/var/uploads', filename))
```

## Security Headers

```python
# Essential security headers
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response
```

## Secrets Management

```python
# Vulnerable: Hardcoded secrets
API_KEY = "sk_live_123456789"

# Secure: Environment variables
import os
API_KEY = os.environ.get('API_KEY')

# Better: Secret management service
# AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
```

## Security Review Checklist

### Code Review
- [ ] All inputs are validated
- [ ] Outputs are properly escaped
- [ ] Authentication is properly implemented
- [ ] Authorization checks are in place
- [ ] Sensitive data is encrypted
- [ ] Secrets are not hardcoded
- [ ] Error messages don't leak information
- [ ] Security headers are set
- [ ] Dependencies are up to date
- [ ] Logging is comprehensive but safe

### Pre-Production
- [ ] Security testing performed (SAST/DAST)
- [ ] Penetration testing completed
- [ ] Dependency vulnerabilities scanned
- [ ] SSL/TLS properly configured
- [ ] Rate limiting implemented
- [ ] Monitoring and alerting set up

## Usage Instructions

When this skill is active:
- Review code for OWASP Top 10 vulnerabilities
- Suggest secure alternatives to vulnerable code
- Identify missing security controls
- Recommend security best practices
- Validate input/output handling
- Check for hardcoded secrets and sensitive data exposure
