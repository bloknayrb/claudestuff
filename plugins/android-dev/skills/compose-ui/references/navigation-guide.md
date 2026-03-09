# Jetpack Navigation for Compose

## Overview

Jetpack Navigation provides structured navigation for Compose apps. **Navigation 2.x is the stable, production-ready library** — it's well-documented, widely used, and fully supported. Navigation 3 is an alpha-stage rewrite with a more Compose-idiomatic API, but it's not yet ready for production use.

## Navigation 2.x (Stable — Recommended)

### Setup

Add to `gradle/libs.versions.toml`:

```toml
[versions]
navigation = "2.8.9"

[libraries]
navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }
```

### Defining Routes

Use `@Serializable` classes for type-safe routes (Navigation 2.8+):

```kotlin
@Serializable
object TaskList  // No arguments — use object

@Serializable
data class TaskDetail(val taskId: Int)  // With arguments — use data class

@Serializable
object AddTask

@Serializable
object Settings
```

### Setting Up Navigation

```kotlin
@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = TaskList) {
        composable<TaskList> {
            TaskListScreen(
                onNavigateToDetail = { taskId ->
                    navController.navigate(TaskDetail(taskId))
                },
                onNavigateToAdd = {
                    navController.navigate(AddTask)
                },
                onNavigateToSettings = {
                    navController.navigate(Settings)
                }
            )
        }

        composable<TaskDetail> { backStackEntry ->
            val route: TaskDetail = backStackEntry.toRoute()
            TaskDetailScreen(
                taskId = route.taskId,
                onBack = { navController.popBackStack() }
            )
        }

        composable<AddTask> {
            AddTaskScreen(
                onTaskAdded = { navController.popBackStack() },
                onBack = { navController.popBackStack() }
            )
        }

        composable<Settings> {
            SettingsScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
```

### Key Concepts

#### Type-Safe Arguments (2.8+)

Navigation 2.8 introduced type-safe routes using `@Serializable` classes — the same approach Navigation 3 uses. This eliminates the old string-based `"route/{argName}"` pattern:

```kotlin
@Serializable
data class TaskDetail(val taskId: Int)

composable<TaskDetail> { backStackEntry ->
    val route: TaskDetail = backStackEntry.toRoute()
    TaskDetailScreen(taskId = route.taskId)
}
```

#### ViewModel Scoping

ViewModels are scoped to their navigation destination automatically:

```kotlin
composable<TaskDetail> {
    val viewModel: TaskDetailViewModel = hiltViewModel()
    TaskDetailScreen(viewModel = viewModel)
}
```

### Common Navigation Patterns

#### Bottom Navigation

```kotlin
@Composable
fun MainScreen() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination

            NavigationBar {
                NavigationBarItem(
                    selected = currentDestination?.hasRoute<TaskList>() == true,
                    onClick = {
                        navController.navigate(TaskList) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    icon = { Icon(Icons.Default.List, contentDescription = "Tasks") },
                    label = { Text("Tasks") }
                )
                NavigationBarItem(
                    selected = currentDestination?.hasRoute<Settings>() == true,
                    onClick = {
                        navController.navigate(Settings) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") }
                )
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = TaskList,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable<TaskList> { /* ... */ }
            composable<Settings> { /* ... */ }
            composable<TaskDetail> { /* ... */ }
        }
    }
}
```

#### Passing Results Back

Use `SavedStateHandle` on the previous back stack entry:

```kotlin
// In the destination that produces a result
navController.previousBackStackEntry?.savedStateHandle?.set("taskAdded", taskId)
navController.popBackStack()

// In the destination that receives the result
val resultTaskId = navController.currentBackStackEntry
    ?.savedStateHandle
    ?.getStateFlow<Int?>("taskAdded", null)
    ?.collectAsStateWithLifecycle()
```

#### Deep Links

```kotlin
composable<TaskDetail>(
    deepLinks = listOf(
        navDeepLink<TaskDetail>(basePath = "myapp://tasks")
    )
) { backStackEntry ->
    val route: TaskDetail = backStackEntry.toRoute()
    TaskDetailScreen(taskId = route.taskId)
}
```

#### String-Based Routes (Legacy Pattern)

If working with an older codebase that uses string routes:

```kotlin
const val TASK_LIST = "task_list"
const val TASK_DETAIL = "task_detail/{taskId}"

NavHost(navController = navController, startDestination = TASK_LIST) {
    composable(TASK_LIST) {
        TaskListScreen(onNavigateToDetail = { id ->
            navController.navigate("task_detail/$id")
        })
    }
    composable(
        route = TASK_DETAIL,
        arguments = listOf(navArgument("taskId") { type = NavType.IntType })
    ) { backStackEntry ->
        val taskId = backStackEntry.arguments?.getInt("taskId") ?: return@composable
        TaskDetailScreen(taskId = taskId)
    }
}
```

Prefer the type-safe `@Serializable` approach for new code.

## Navigation 3 (Alpha Preview)

> **Warning**: Navigation 3 is in alpha (`3.0.0-alpha10` as of early 2025). The API may have breaking changes between releases. Use it for experimentation and prototyping, not production apps.

Navigation 3 replaces `NavHost`/`NavController` with a simpler list-based back stack. The back stack is just a `SnapshotStateList<Any>` — you navigate by adding to it and go back by removing from it.

### Setup

```toml
[versions]
nav3 = "3.0.0-alpha10"

[libraries]
navigation3-compose = { group = "androidx.navigation3", name = "navigation-compose", version.ref = "nav3" }
```

### Basic Usage

```kotlin
@Composable
fun AppNavigation() {
    val backStack = rememberMutableStateListOf<Any>(TaskList)

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<TaskList> {
                TaskListScreen(
                    onNavigateToDetail = { taskId ->
                        backStack.add(TaskDetail(taskId))
                    }
                )
            }

            entry<TaskDetail> { route ->
                TaskDetailScreen(
                    taskId = route.taskId,
                    onBack = { backStack.removeLastOrNull() }
                )
            }
        }
    )
}
```

### Why Nav 3 Is Interesting

- **Back stack is transparent** — it's a regular Kotlin list, not a framework abstraction
- **No NavController** — navigation is just list operations (`add`, `removeLastOrNull`, `clear`)
- **Same type-safe routes** — uses the same `@Serializable` route classes as Nav 2.8+

### When to Use Nav 3

- **Side projects and prototypes** where alpha instability is acceptable
- **Learning** the direction Jetpack Navigation is heading
- **Not recommended** for production apps shipping to users
