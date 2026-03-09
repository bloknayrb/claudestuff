---
name: android-architecture
description: This skill should be used when the user asks about "Android project setup", "new Android app", "MVVM", "Clean Architecture", "Android architecture", "Hilt", "dependency injection", "Room database", "Retrofit", "data layer", "repository pattern", "Android project structure", "Kotlin Android", "Jetpack libraries", or mentions starting a new Android project, choosing an architecture pattern, or setting up dependency injection. Provides opinionated architecture guidance for Kotlin/Compose Android apps.
version: 1.0.0
tags: [android, architecture, kotlin, mvvm, hilt, jetpack]
allowed-tools: [Read]
---

# Android Architecture

## Overview

Provide opinionated architecture guidance for modern Android apps built with Kotlin and Jetpack Compose. Follow convention-over-configuration: recommend proven defaults and explain when alternatives make sense. All guidance targets Compose-first, Kotlin-only development using official Jetpack libraries.

> **Disclaimer**: This skill provides educational guidance for learning Android development. For production apps handling sensitive user data, payment processing, authentication, or security-critical features, consult a professional Android developer or security auditor.

## Philosophy

- **Convention over configuration** — pick the right default so users don't have to choose
- **Official Jetpack libraries first** — prefer Google-maintained solutions over third-party
- **Compose-first, Kotlin-only** — no XML layouts or Java for new projects
- **Teach the "why"** — every pattern explained, not just pasted

## Architecture Decision Table

Use this to recommend the right level of architecture based on app complexity:

| App Complexity | Architecture | DI | Data Layer | Navigation |
|---|---|---|---|---|
| **Simple** (1-3 screens, local data) | Single-module MVVM | Manual or Hilt | Room or DataStore | Jetpack Navigation 3 |
| **Medium** (4-10 screens, network + local) | Multi-module MVVM | Hilt | Repository pattern, Room + Retrofit | Jetpack Navigation 3 |
| **Complex** (10+ screens, multiple data sources) | Clean Architecture with MVVM | Hilt | Use case layer, Repository pattern | Jetpack Navigation 3, type-safe routes |

## Standard Project Structure

Recommend this package layout for medium-complexity apps:

```
com.example.myapp/
├── data/
│   ├── local/          # Room database, DAOs, entities
│   ├── remote/         # Retrofit services, DTOs
│   └── repository/     # Repository implementations
├── di/                 # Hilt modules
├── domain/             # (Clean Architecture only) Use cases, domain models
├── ui/
│   ├── components/     # Reusable Compose components
│   ├── navigation/     # Navigation graph, routes
│   ├── screens/        # Screen composables + ViewModels
│   └── theme/          # Material 3 theme, colors, typography
└── util/               # Extension functions, constants
```

For simple apps, flatten `data/` and skip `domain/`.

## Technology Selection Matrix

| Need | Default Choice | Alternative | When to Switch |
|---|---|---|---|
| Architecture | MVVM | MVI | Complex state machines, heavy user interaction flows |
| Dependency Injection | Hilt | Koin | Kotlin Multiplatform projects, or personal preference |
| Networking | Retrofit + OkHttp | Ktor | Kotlin Multiplatform shared networking |
| Local Database | Room | SQLDelight | Kotlin Multiplatform shared database |
| Key-Value Storage | DataStore (Preferences) | — | Always use DataStore; SharedPreferences is legacy |
| Image Loading | Coil | Glide | Existing project already using Glide |
| Serialization | Kotlin Serialization | Moshi, Gson | Moshi for Java interop; Gson is legacy |
| UI Framework | Jetpack Compose | XML Views | Only for maintaining existing XML codebases |

## Kotlin Multiplatform Awareness

If the user mentions KMP, Compose Multiplatform, or shared logic:
- Use Ktor instead of Retrofit for networking
- Use SQLDelight instead of Room for databases
- Use Koin instead of Hilt for DI (Hilt is Android-only)
- Shared ViewModels are possible with KMP-ViewModel
- This plugin covers Android-native; for full KMP guidance, recommend official KMP documentation

## Common Architecture Mistakes

| Mistake | Why It's Wrong | Correct Approach |
|---|---|---|
| Business logic in Composables | Untestable, survives recomposition poorly | Move to ViewModel |
| ViewModel calling DAO directly | Tight coupling, hard to test | Use Repository pattern |
| Passing ViewModel to child Composables | Couples UI tree to specific ViewModel | Pass state and callbacks down |
| Using `GlobalScope` for coroutines | Leaks, not lifecycle-aware | Use `viewModelScope` or `lifecycleScope` |
| Storing UI state in `remember` across config changes | Lost on rotation | Use ViewModel + `StateFlow` |
| Network calls on Main thread | ANR (Application Not Responding) | Dispatchers.IO via Repository |

## References

- `references/project-setup-guide.md` — Step-by-step new project walkthrough with Android Studio setup
- `references/architecture-patterns.md` — MVVM and Clean Architecture with full code examples
- `references/dependency-injection.md` — Hilt setup, modules, scoping, and testing patterns
