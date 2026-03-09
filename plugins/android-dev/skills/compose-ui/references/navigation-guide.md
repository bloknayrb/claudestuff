# Jetpack Navigation 3

## Overview

Navigation 3 is the latest Jetpack navigation library for Compose. It uses a simple list-based back stack and type-safe routes defined as Kotlin classes or objects. Navigation 3 replaces the older NavHost/NavController approach with a more Compose-idiomatic API.

> **Note**: Navigation 3 is in alpha as of early 2025. The API may change, but the concepts are stable and this is the recommended approach for new projects. If you need production stability now, the older `navigation-compose` (2.x) is still fully supported.

## Setup

Add to `gradle/libs.versions.toml`:

```toml
[versions]
navigation = "3.0.0-alpha10"

[libraries]
navigation-compose = { group = "androidx.navigation3", name = "navigation-compose", version.ref = "navigation" }
```

## Defining Routes

Routes are regular Kotlin classes or objects. Use `@Serializable` for type-safe argument passing:

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

## Setting Up Navigation

```kotlin
@Composable
fun AppNavigation() {
    // The back stack is just a list of route objects
    val backStack = rememberMutableStateListOf<Any>(TaskList)

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<TaskList> {
                TaskListScreen(
                    onNavigateToDetail = { taskId ->
                        backStack.add(TaskDetail(taskId))
                    },
                    onNavigateToAdd = {
                        backStack.add(AddTask)
                    },
                    onNavigateToSettings = {
                        backStack.add(Settings)
                    }
                )
            }

            entry<TaskDetail> { route ->
                TaskDetailScreen(
                    taskId = route.taskId,
                    onBack = { backStack.removeLastOrNull() }
                )
            }

            entry<AddTask> {
                AddTaskScreen(
                    onTaskAdded = { backStack.removeLastOrNull() },
                    onBack = { backStack.removeLastOrNull() }
                )
            }

            entry<Settings> {
                SettingsScreen(
                    onBack = { backStack.removeLastOrNull() }
                )
            }
        }
    )
}
```

## Key Concepts

### Back Stack as a List

Navigation 3's back stack is just a `SnapshotStateList<Any>`. You navigate by adding to it and go back by removing from it. This is simpler and more transparent than the NavController approach.

```kotlin
// Navigate forward
backStack.add(TaskDetail(taskId = 42))

// Go back
backStack.removeLastOrNull()

// Go back to root
backStack.clear()
backStack.add(TaskList)
```

### Type-Safe Arguments

Since routes are Kotlin classes, arguments are type-safe at compile time:

```kotlin
@Serializable
data class TaskDetail(val taskId: Int)

// In the entry provider, access arguments directly:
entry<TaskDetail> { route ->
    TaskDetailScreen(taskId = route.taskId)
}
```

No more `navController.getBackStackEntry(...).arguments?.getInt("taskId")`.

### ViewModel Scoping

ViewModels in Navigation 3 are scoped to their entry automatically when using `hiltViewModel()`:

```kotlin
entry<TaskDetail> { route ->
    // This ViewModel is scoped to this TaskDetail entry
    val viewModel: TaskDetailViewModel = hiltViewModel()
    TaskDetailScreen(viewModel = viewModel)
}
```

## Common Navigation Patterns

### Bottom Navigation

```kotlin
@Composable
fun MainScreen() {
    val backStack = rememberMutableStateListOf<Any>(TaskList)
    val currentRoute = backStack.lastOrNull()

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = currentRoute is TaskList,
                    onClick = {
                        backStack.clear()
                        backStack.add(TaskList)
                    },
                    icon = { Icon(Icons.Default.List, contentDescription = "Tasks") },
                    label = { Text("Tasks") }
                )
                NavigationBarItem(
                    selected = currentRoute is Settings,
                    onClick = {
                        backStack.clear()
                        backStack.add(Settings)
                    },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") }
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            NavDisplay(
                backStack = backStack,
                onBack = { backStack.removeLastOrNull() },
                entryProvider = entryProvider {
                    entry<TaskList> { /* ... */ }
                    entry<Settings> { /* ... */ }
                    entry<TaskDetail> { /* ... */ }
                }
            )
        }
    }
}
```

### Passing Results Back

Since the back stack is a simple list, passing results back is straightforward:

```kotlin
@Composable
fun AppNavigation() {
    val backStack = rememberMutableStateListOf<Any>(TaskList)
    var lastAddedTaskId by remember { mutableStateOf<Int?>(null) }

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<TaskList> {
                // React to result
                LaunchedEffect(lastAddedTaskId) {
                    lastAddedTaskId?.let { id ->
                        // Show snackbar, scroll to item, etc.
                        lastAddedTaskId = null
                    }
                }
                TaskListScreen(
                    onNavigateToAdd = { backStack.add(AddTask) }
                )
            }

            entry<AddTask> {
                AddTaskScreen(
                    onTaskAdded = { taskId ->
                        lastAddedTaskId = taskId
                        backStack.removeLastOrNull()
                    }
                )
            }
        }
    )
}
```

### Deep Links

```kotlin
entry<TaskDetail>(
    metadata = NavEntryMetadata(
        deepLinks = listOf(
            navDeepLink<TaskDetail>(basePath = "myapp://tasks")
        )
    )
) { route ->
    TaskDetailScreen(taskId = route.taskId)
}
```

## Using Navigation 2.x (Stable Alternative)

If you need production stability, the older navigation-compose works well:

```kotlin
// Routes as strings
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

Navigation 3 is simpler and more type-safe — prefer it for new projects.
