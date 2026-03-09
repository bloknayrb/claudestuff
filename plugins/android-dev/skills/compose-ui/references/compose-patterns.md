# Compose UI Patterns

## Foundational Patterns

### Stateless Composable Pattern

Separate state ownership from rendering. The outer composable owns state; the inner one just draws:

```kotlin
// Stateful wrapper — owns the ViewModel
@Composable
fun TaskListScreen(
    viewModel: TaskListViewModel = hiltViewModel(),
    onNavigateToDetail: (Int) -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    TaskListContent(
        uiState = uiState,
        onAddTask = viewModel::addTask,
        onToggleTask = viewModel::toggleTask,
        onTaskClick = { onNavigateToDetail(it.id) }
    )
}

// Stateless content — pure function of parameters, easy to preview and test
@Composable
fun TaskListContent(
    uiState: TaskListUiState,
    onAddTask: (String) -> Unit,
    onToggleTask: (Task) -> Unit,
    onTaskClick: (Task) -> Unit,
    modifier: Modifier = Modifier
) {
    // Rendering logic only — no ViewModel reference
}
```

### Modifier as First Optional Parameter

Always accept a `Modifier` parameter as the first optional parameter:

```kotlin
@Composable
fun TaskItem(
    task: Task,
    onToggle: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier  // Always include this
) {
    Card(
        modifier = modifier.fillMaxWidth(),  // Apply caller's modifier first
        onClick = onClick
    ) {
        // ...
    }
}
```

## Common Components

### List Item with Swipe-to-Delete

```kotlin
@Composable
fun TaskItem(
    task: Task,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onDelete()
                true
            } else false
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Delete task",
                    tint = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        },
        modifier = modifier
    ) {
        Card(onClick = onClick) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Checkbox(
                    checked = task.isCompleted,
                    onCheckedChange = { onToggle() }
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = task.title,
                        style = MaterialTheme.typography.bodyLarge,
                        textDecoration = if (task.isCompleted) {
                            TextDecoration.LineThrough
                        } else null
                    )
                    if (task.description.isNotBlank()) {
                        Text(
                            text = task.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
```

### Form with Validation

```kotlin
@Composable
fun AddTaskDialog(
    onDismiss: () -> Unit,
    onConfirm: (title: String, description: String) -> Unit
) {
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var titleError by rememberSaveable { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Task") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = {
                        title = it
                        titleError = null  // Clear error on edit
                    },
                    label = { Text("Title") },
                    isError = titleError != null,
                    supportingText = titleError?.let { { Text(it) } },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (title.isBlank()) {
                        titleError = "Title is required"
                    } else {
                        onConfirm(title.trim(), description.trim())
                        onDismiss()
                    }
                }
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
```

### Loading/Error/Content Pattern

Reusable pattern for screens with async data:

```kotlin
@Composable
fun <T> AsyncContent(
    uiState: UiState<T>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    loadingContent: @Composable () -> Unit = {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    },
    content: @Composable (T) -> Unit
) {
    when (uiState) {
        is UiState.Loading -> loadingContent()
        is UiState.Error -> {
            Column(
                modifier = modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = uiState.message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyLarge
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = onRetry) {
                    Text("Retry")
                }
            }
        }
        is UiState.Success -> content(uiState.data)
    }
}
```

## Theming

### Material 3 Theme Setup

```kotlin
@Composable
fun MyAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> darkColorScheme()
        else -> lightColorScheme()
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,  // Define in Type.kt
        content = content
    )
}
```

### Using Theme Values (Never Hardcode)

```kotlin
// Good — adapts to theme
Text(
    text = "Hello",
    color = MaterialTheme.colorScheme.onSurface,
    style = MaterialTheme.typography.headlineMedium
)

// Bad — hardcoded, ignores dark mode and dynamic color
Text(
    text = "Hello",
    color = Color.Black,
    fontSize = 24.sp
)
```

## Preview Patterns

```kotlin
@Preview(showBackground = true)
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES, name = "Dark")
@Composable
private fun TaskItemPreview() {
    MyAppTheme {
        TaskItem(
            task = Task(title = "Buy groceries", description = "Milk, eggs, bread"),
            onToggle = {},
            onDelete = {},
            onClick = {}
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 640)
@Composable
private fun TaskListContentPreview() {
    MyAppTheme {
        TaskListContent(
            uiState = TaskListUiState.Success(
                tasks = listOf(
                    Task(id = 1, title = "Buy groceries"),
                    Task(id = 2, title = "Walk the dog", isCompleted = true),
                    Task(id = 3, title = "Write code", description = "Finish the task list feature")
                )
            ),
            onAddTask = {},
            onToggleTask = {},
            onTaskClick = {}
        )
    }
}
```

## Performance Tips

- Use `key` parameter in `LazyColumn` items for stable identity
- Avoid creating lambdas in the composition — use method references (`viewModel::addTask`)
- Use `derivedStateOf` for computed values that change less often than their inputs
- Use `Modifier.drawBehind` for custom drawing instead of `Canvas` composable when possible
- Profile with Layout Inspector and Composition Tracing before optimizing
