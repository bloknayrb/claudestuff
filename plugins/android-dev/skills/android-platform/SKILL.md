---
name: android-platform
description: This skill should be used when the user asks about "Android permissions", "runtime permissions", "camera permission", "storage permission", "notifications", "Photo Picker", "Credential Manager", "Predictive Back", "per-app language", "Baseline Profiles", "Android 16", "adaptive layouts", "Android crash", "Gradle sync fails", "build error", "ANR", "ProGuard", "R8", "Android emulator", or mentions requesting permissions, using platform APIs, troubleshooting Android errors, or dealing with crashes and build failures. Provides permissions guidance, modern platform features, and troubleshooting for Android development.
version: 1.0.0
tags: [android, permissions, platform, troubleshooting, debugging]
allowed-tools: [Read]
---

# Android Platform

## Overview

Guide users through Android platform features, runtime permissions, and troubleshooting. Cover modern APIs that replace older approaches, permission best practices, and common error resolution. Emphasis on current best practices — many online tutorials teach deprecated patterns.

> **Disclaimer**: This skill provides educational guidance for learning Android development. For production apps handling sensitive user data, payment processing, authentication, or security-critical features, consult a professional Android developer or security auditor.

## Runtime Permissions Decision Tree

Before requesting a permission, check if you actually need it:

```
Do I need this capability?
├── Camera → REQUEST_PERMISSION (CAMERA)
├── Location → REQUEST_PERMISSION (ACCESS_FINE_LOCATION or COARSE)
├── Pick a photo/video → USE Photo Picker (no permission needed!)
├── Read/write media → USE MediaStore API (scoped storage, no permission needed for own files)
├── Read all files → AVOID if possible; REQUEST_PERMISSION (READ_MEDIA_IMAGES etc.) if needed
├── Notifications (API 33+) → REQUEST_PERMISSION (POST_NOTIFICATIONS)
├── Bluetooth (API 31+) → REQUEST_PERMISSION (BLUETOOTH_CONNECT)
└── Contacts, Calendar, etc. → REQUEST_PERMISSION (specific permission)
```

### Permission Request Flow

1. Check if the feature is essential — if optional, offer degraded experience without it
2. Explain *why* before requesting — users grant permissions at higher rates when they understand the reason
3. Use `ActivityResultContracts.RequestPermission()` (not the deprecated `onRequestPermissionsResult`)
4. Handle denial gracefully — show explanation, offer alternative, never block the app
5. Handle "Don't ask again" — direct user to Settings with a clear explanation

## Modern Platform Features

Features that replace older approaches — present with rolling API requirements:

| Feature | Min API | What It Replaces | Why It Matters |
|---|---|---|---|
| **Photo Picker** | 19 (backported) | `READ_EXTERNAL_STORAGE` for media selection | No permission needed; scoped, privacy-preserving |
| **Credential Manager** | 23 (backported) | SmartLock, legacy login flows | Passkeys, passwords, federated sign-in in one API |
| **Predictive Back** | 34+ (opt-in, default on API 35+) | `onBackPressed()` override | System back gesture shows preview; breaks apps that don't handle it |
| **Per-app Language** | 33+ | Manual locale switching | System-managed language per app |
| **Baseline Profiles** | 24+ | No equivalent | 15-50% cold start improvement; profiles compiled AOT |
| **Scoped Storage** | 29+ (enforced 30+) | `WRITE_EXTERNAL_STORAGE` | App-specific dirs without permission; MediaStore for shared media |
| **Foreground Service Types** | 34+ | Untyped foreground services | Must declare type (camera, location, etc.) in manifest |
| **Adaptive Layouts** | Recommended for all | Fixed orientation lock | Can't restrict orientation on large screens (Android 16+) |

## Predictive Back — Important Note

Predictive Back is **on by default starting API 35**. Apps that override `onBackPressed()` or use `FLAG_ACTIVITY_CLEAR_TOP` carelessly will break. To prepare:
- Use `OnBackPressedCallback` instead of overriding `onBackPressed()`
- Enable `android:enableOnBackInvokedCallback="true"` in the manifest to test
- Compose Navigation handles this correctly by default

## Troubleshooting Quick Reference

| Error / Symptom | Likely Cause | Fix |
|---|---|---|
| `Gradle sync failed` | Version mismatch, missing SDK | Check `references/troubleshooting.md` |
| `Unresolved reference` after adding dependency | Missing Gradle sync | Sync Gradle files |
| App crashes on rotation | State not in ViewModel | Move state to ViewModel + StateFlow |
| `NetworkOnMainThreadException` | Network call on Main thread | Use `Dispatchers.IO` in repository |
| Compose preview blank | Missing `@Preview` parameter defaults | Add default parameter values |
| `INSTALL_FAILED_OLDER_SDK` | Device API < `minSdk` | Lower `minSdk` or use newer device |
| Emulator won't start | Hardware acceleration disabled | Enable VT-x/AMD-V in BIOS |
| `Could not find :compose-bom` | Missing Google Maven repository | Add `google()` to `repositories` block |
| R8/ProGuard strips needed class | Missing keep rule | Add `-keep` rule for the class |
| `java.lang.OutOfMemoryError` during build | Insufficient Gradle heap | Increase `org.gradle.jvmargs` in `gradle.properties` |

## Security Awareness

Flag these areas for professional review — they're beyond educational scope:

- **Authentication & user data** — Use Credential Manager for basic login; complex auth (OAuth, HIPAA data) needs professional review
- **Payment processing** — Use Google Play Billing Library; never handle raw payment data
- **Encryption** — Use Jetpack Security (EncryptedSharedPreferences, EncryptedFile) for local secrets
- **Network security** — Enable certificate pinning for sensitive APIs; use Network Security Config
- **API keys** — Never commit to source control; use `local.properties` or BuildConfig injection

## References

- `references/permissions-guide.md` — Runtime permissions patterns with complete code examples
- `references/platform-features.md` — Credential Manager, Predictive Back, Photo Picker, Baseline Profiles deep dives
- `references/troubleshooting.md` — Common errors, Gradle failures, crash debugging, emulator fixes
