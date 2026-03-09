# Android Dev Plugin

A Claude Code plugin for Android app development — project setup, Jetpack Compose, architecture, testing, troubleshooting, and Play Store publishing. Designed for non-developers and Android newcomers who want to build real apps with guidance at every step.

> **Disclaimer**: This plugin provides educational guidance for learning Android development. For production apps handling sensitive user data, payment processing, authentication, or security-critical features, consult a professional Android developer or security auditor.

## Philosophy

- **Convention over configuration** — pick the right default so you don't have to choose
- **Official Jetpack libraries first** — prefer Google-maintained solutions over third-party
- **Compose-first, Kotlin-only** — modern Android development, no legacy XML or Java
- **Material 3 for consistent UX** — visual polish from day one
- **Accessibility by default** — contentDescription, semantic labels, touch targets
- **Security awareness** — flags when you need professional review
- **Teach the "why"** — every pattern explained, not just pasted

## What's Included

### Agent (1)

**android-dev** — Primary interaction agent for all Android development tasks. Routes to the right skill based on your question: architecture for new projects, Compose for UI work, platform APIs for permissions and features, build/test/publish for release workflow. Adapts explanations to your experience level.

### Skills (4)

**android-architecture** — Project setup, MVVM and Clean Architecture patterns, Hilt dependency injection, technology selection (Room, Retrofit, Coil, DataStore), standard project structure, Kotlin Multiplatform awareness.

**compose-ui** — Jetpack Compose component patterns, state management (remember, StateFlow, UiState pattern), Jetpack Navigation 3, Material 3 theming with dynamic color, accessibility defaults, layout solutions.

**android-platform** — Runtime permissions with modern alternatives (Photo Picker, scoped storage), Predictive Back migration, Credential Manager, per-app language, Baseline Profiles, adaptive layouts, troubleshooting common crashes and build errors.

**build-test-publish** — Testing pyramid (unit/integration/UI with JUnit 5, MockK, Turbine, Compose Testing), Gradle version catalogs, KSP migration, build types and flavors, Play Store publishing from signing to staged rollout.

### Reference Files (12)

| File | Content |
|------|---------|
| `android-architecture/references/project-setup-guide.md` | New project walkthrough, Android Studio setup, MVVM expansion |
| `android-architecture/references/architecture-patterns.md` | MVVM and Clean Architecture with complete code examples |
| `android-architecture/references/dependency-injection.md` | Hilt setup, modules, scoping, qualifiers, testing |
| `compose-ui/references/compose-patterns.md` | Stateless composables, list items, forms, theming, previews |
| `compose-ui/references/navigation-guide.md` | Navigation 3 setup, type-safe routes, bottom nav, deep links |
| `compose-ui/references/state-management.md` | StateFlow, UiState, recomposition, one-time events, Turbine testing |
| `android-platform/references/permissions-guide.md` | Runtime permissions, Photo Picker, notification permission |
| `android-platform/references/platform-features.md` | Credential Manager, Predictive Back, Baseline Profiles, adaptive layouts |
| `android-platform/references/troubleshooting.md` | Gradle sync failures, build errors, runtime crashes, emulator fixes |
| `build-test-publish/references/gradle-guide.md` | Version catalogs, module build config, KSP, build types, flavors |
| `build-test-publish/references/testing-strategy.md` | Unit, integration, UI testing with complete code examples |
| `build-test-publish/references/publishing-checklist.md` | Play Store step-by-step from signing to staged rollout |

## Installation

```bash
/plugin install android-dev
```

Or from the marketplace:

```bash
/plugin marketplace add bloknayrb/claudestuff
```

## Usage Examples

**Starting a new project:**
- "I want to build a todo app for Android"
- "Help me set up a new Android project with Hilt and Room"

**Architecture decisions:**
- "How should I structure my data layer?"
- "Should I use Clean Architecture for my app?"

**Building UI:**
- "Help me create a login screen with Compose"
- "How do I make a scrollable list with pull-to-refresh?"

**Platform features:**
- "How do I request camera permission?"
- "My app needs to let users pick photos"

**Troubleshooting:**
- "My app crashes when I rotate the screen"
- "Gradle sync failed with 'Could not resolve' — what do I do?"

**Testing and publishing:**
- "How do I test my ViewModel?"
- "I'm ready to publish to the Play Store — what do I need?"

## Scope

**This plugin covers:**
- Android-native development with Kotlin and Jetpack Compose
- Architecture patterns (MVVM, Clean Architecture, Repository)
- Jetpack libraries (Room, Hilt, Navigation, DataStore, Compose)
- Material 3 design and theming
- Android platform APIs and permissions
- Gradle build configuration
- Testing (unit, integration, UI)
- Play Store publishing

**This plugin does NOT cover:**
- iOS development
- Cross-platform frameworks (Flutter, React Native)
- Backend/server development
- Kotlin Multiplatform (mentioned for awareness, not deeply covered)
- Game development (Unity, Unreal)
- Wear OS, Android TV, or Android Auto
