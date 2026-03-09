---
name: build-test-publish
description: This skill should be used when the user asks about "Android testing", "unit test", "UI test", "Espresso", "Compose testing", "Gradle", "build.gradle", "version catalog", "KSP", "kapt", "ProGuard", "R8", "signing", "release build", "Play Store", "publish app", "AAB", "APK", "product flavors", "build types", "CI/CD Android", or mentions testing their Android app, configuring Gradle, building for release, or publishing to the Google Play Store. Provides testing strategy, build configuration, and publishing guidance.
version: 1.0.0
tags: [android, testing, gradle, publishing, playstore]
allowed-tools: [Read]
---

# Build, Test & Publish

## Overview

Guide users through testing Android apps, configuring Gradle builds, and publishing to the Google Play Store. Cover the testing pyramid, version catalogs, signing, and store listing requirements. Emphasis on testable architecture from the start — retrofitting tests is painful.

> **Disclaimer**: This skill provides educational guidance for learning Android development. For production apps handling sensitive user data, payment processing, authentication, or security-critical features, consult a professional Android developer or security auditor.

## Testing Pyramid

Start with this ratio as a guideline — adjust based on your app:

```
        /  UI Tests  \        ~10%  Compose UI tests, end-to-end
       / Integration  \       ~20%  ViewModel + Repository, Hilt test modules
      /   Unit Tests   \      ~70%  ViewModels, Repositories, Use Cases, Mappers
```

| Test Type | What It Tests | Framework | Speed |
|---|---|---|---|
| **Unit** | Pure logic, ViewModels, mappers | JUnit 5 + MockK + Turbine | Milliseconds |
| **Integration** | ViewModel + real Repository, Room queries | JUnit 5 + Hilt testing + Room in-memory | Seconds |
| **UI** | Screen rendering, user interactions | Compose Testing (`createComposeRule`) | Seconds-minutes |
| **End-to-End** | Full user flows across screens | Compose Testing + Navigation | Minutes |

### Key Testing Libraries

| Library | Purpose |
|---|---|
| JUnit 5 | Test runner and assertions |
| MockK | Kotlin-first mocking (prefer over Mockito) |
| Turbine | Testing Kotlin `Flow` and `StateFlow` emissions |
| Compose Testing | `ComposeTestRule`, semantic matchers, actions |
| Hilt Testing | `@HiltAndroidTest`, test modules, `@UninstallModules` |
| Room Testing | In-memory database for DAO testing |
| Robolectric | Run Android tests on JVM (faster, less accurate) |

## Build Configuration Overview

Modern Android builds use:

- **Version Catalogs** (`libs.versions.toml`) — single source of truth for all dependency versions
- **KSP** (Kotlin Symbol Processing) — replaces kapt for annotation processing; faster, Kotlin-native
- **Convention Plugins** — shared build logic across modules (for multi-module projects)
- **Build Types** — `debug` (development) and `release` (production, minified, signed)
- **Product Flavors** — variants for different configurations (free/paid, staging/production)

### Gradle Version Catalog Quick Reference

All dependencies declared in `gradle/libs.versions.toml`:

```toml
[versions]
agp = "8.7.0"  # Update these to current stable
kotlin = "2.1.0"
compose-bom = "2025.01.01"

[libraries]
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
compose-compiler = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
```

Referenced in `build.gradle.kts` as `libs.androidx.compose.bom`, `libs.plugins.android.application`, etc.

## Publishing Requirements

Play Store requires these for launch:

| Requirement | Details |
|---|---|
| **Format** | Android App Bundle (AAB), not APK |
| **Target SDK** | Must target current rolling requirement (check Play Console for deadline) |
| **Signing** | Upload key (managed by Play App Signing recommended) |
| **Store Listing** | Title, descriptions, screenshots (phone + tablet if supporting), feature graphic |
| **Privacy Policy** | Required URL if app collects any user data |
| **Content Rating** | Complete IARC questionnaire |
| **Data Safety** | Declare all data collection, sharing, and security practices |
| **Testing** | At least internal testing track before production release |

## Gradle Troubleshooting Top 5

| Issue | Cause | Fix |
|---|---|---|
| `Could not resolve` dependency | Missing repository or wrong version | Check `google()` and `mavenCentral()` in repositories; verify version exists |
| Build takes forever | No build cache, no parallel execution | Enable `org.gradle.caching=true` and `org.gradle.parallel=true` in `gradle.properties` |
| `Duplicate class` error | Transitive dependency conflict | Use `./gradlew dependencies` to find conflict; exclude or force version |
| KSP/kapt errors after update | Processor version mismatch | Align KSP version with Kotlin version exactly |
| `Execution failed for task :app:merge*` | Resource or manifest conflict | Check for duplicate resources across modules/flavors |

## References

- `references/gradle-guide.md` — Build config, version catalogs, KSP migration, multi-module setup
- `references/testing-strategy.md` — Unit, integration, and UI testing with complete code examples
- `references/publishing-checklist.md` — Play Store step-by-step from signing to release
