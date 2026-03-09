---
name: compose-ui
description: This skill should be used when the user asks about "Jetpack Compose", "Compose UI", "Composable", "Compose layout", "LazyColumn", "Scaffold", "Material 3", "Material Design", "Compose navigation", "state management", "remember", "mutableStateOf", "StateFlow", "recomposition", "Modifier", "Compose theme", "UI state", "screen layout", "Compose animation", "Compose list", or mentions building Android UI, creating screens, handling state in Compose, or navigation between screens. Provides Compose-first UI patterns, state management, and navigation guidance.
version: 1.0.0
tags: [android, compose, ui, material3, navigation, state]
allowed-tools: [Read]
---

# Compose UI

## Overview

Provide guidance for building Android UIs with Jetpack Compose and Material 3. Cover component patterns, state management, navigation, theming, and accessibility. All examples use Compose-first patterns — no XML layouts.

> **Disclaimer**: This skill provides educational guidance for learning Android development. For production apps handling sensitive user data, payment processing, authentication, or security-critical features, consult a professional Android developer or security auditor.

## Core Concepts Quick Reference

| Concept | What It Is | Key Rule |
|---|---|---|
| `@Composable` | Function that describes UI | No side effects; UI = f(state) |
| `remember` | Survives recomposition | Lost on configuration change (rotation) |
| `rememberSaveable` | Survives configuration change | For simple types; use ViewModel for complex state |
| `State` / `MutableState` | Observable value that triggers recomposition | Hoist state up, push events down |
| `Modifier` | Chain of UI decorations | Order matters — applied sequentially |
| `LaunchedEffect` | Side effect tied to composition lifecycle | For one-time loads, navigation events |
| `DisposableEffect` | Side effect with cleanup | For listeners, observers, callbacks |

## State Management Decision Tree

Choose the right state approach based on scope:

| State Scope | Where to Put It | Mechanism | Example |
|---|---|---|---|
| **Single composable** (animation, toggle) | `remember` / `rememberSaveable` | `mutableStateOf` | Expanded/collapsed card |
| **Screen-level** (form data, loading state) | ViewModel | `StateFlow<UiState>` | Login form, list + loading + error |
| **Cross-screen** (user session, settings) | ViewModel + Repository | `StateFlow` from Repository | Auth state, user preferences |
| **App-wide** (theme, locale) | CompositionLocal or Hilt | `CompositionLocalProvider` | Dark mode, feature flags |

### UiState Pattern

The recommended pattern for screen state — a sealed interface covering all states:

```kotlin
sealed interface TaskListUiState {
    data object Loading : TaskListUiState
    data class Success(val tasks: List<Task>) : TaskListUiState
    data class Error(val message: String) : TaskListUiState
}
```

The ViewModel exposes a `StateFlow<UiState>`, and the Composable observes it with `collectAsStateWithLifecycle()`.

## Common Screen Templates

Quick structural reference — full code examples in `references/compose-patterns.md`.

**List Screen** — `Scaffold` + `LazyColumn` + pull-to-refresh + FAB. Handles loading, empty, error, and content states via UiState.

**Detail Screen** — `Scaffold` + `TopAppBar` with back navigation + scrollable `Column`. Receives item ID via navigation argument, loads data in ViewModel.

**Form Screen** — `Scaffold` + `Column` with `TextField` inputs + validation. State hoisted to ViewModel; validation runs on submit, not on every keystroke.

**Settings Screen** — `LazyColumn` with `ListItem` composables. Uses `PreferencesDataStore` for persistence. Toggle items use `Switch`.

## Material 3 Essentials

- Use `MaterialTheme` for all colors, typography, and shapes — never hardcode values
- Use dynamic color (`dynamicColorScheme`) on Android 12+ for personalization
- `Surface` is the base container — it provides background color and elevation
- Follow Material 3 component specs for touch targets (minimum 48dp)
- Material 3 Expressive (rolling out) adds richer motion and emphasis — watch for new components

## Accessibility Defaults

Always include these — they're not optional:

- `contentDescription` on all `Image` and `Icon` composables (use `null` for decorative images)
- `Modifier.semantics` for custom components that convey meaning
- Minimum touch target 48dp (Material 3 components handle this automatically)
- Use `Modifier.clearAndSetSemantics` to merge child semantics when appropriate
- Test with TalkBack during development

## Layout Pattern Solutions

| I Want To... | Use This |
|---|---|
| Stack items vertically | `Column` |
| Stack items horizontally | `Row` |
| Layer items on top of each other | `Box` |
| Show a scrollable list | `LazyColumn` / `LazyRow` |
| Show a grid | `LazyVerticalGrid` |
| Screen with top bar and FAB | `Scaffold` |
| Pull-to-refresh list | `PullToRefreshBox` (Material 3) |
| Responsive layout (phone vs tablet) | `WindowSizeClass` |
| Adaptive navigation (bottom bar vs rail vs drawer) | `NavigationSuiteScaffold` |

## References

- `references/compose-patterns.md` — Component patterns with complete code examples
- `references/navigation-guide.md` — Jetpack Navigation 3 setup and patterns
- `references/state-management.md` — StateFlow, UiState, recomposition, and testing state
