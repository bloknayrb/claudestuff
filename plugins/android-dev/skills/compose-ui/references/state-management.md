# State Management in Compose

## The Fundamental Rule

**UI = f(state)**. Compose renders UI as a function of state. When state changes, Compose re-executes (recomposes) the affected composables. Your job is to manage where state lives and how it flows.

## State Mechanisms

### Local State: `remember` and `mutableStateOf`

For state that belongs to a single composable:

```kotlin
@Composable
fun ExpandableCard(title: String, content: String) {
    var expanded by remember { mutableStateOf(false) }

    Card(onClick = { expanded = !expanded }) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium)
            AnimatedVisibility(visible = expanded) {
                Text(text = content, modifier = Modifier.padding(top = 8.dp))
            }
        }
    }
}
```

**`remember`** preserves value across recompositions but is lost on configuration change (rotation).

**`rememberSaveable`** survives configuration changes by saving to the saved instance state bundle:

```kotlin
var searchQuery by rememberSaveable { mutableStateOf("") }
```

Use `rememberSaveable` for user input that would be frustrating to lose on rotation.

### Screen State: ViewModel + StateFlow

For state that represents a screen's data (loaded from network/database, survives rotation):

```kotlin
@HiltViewModel
class TaskListViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val uiState: StateFlow<TaskListUiState> = combine(
        repository.getAllTasks(),
        _searchQuery
    ) { tasks, query ->
        val filtered = if (query.isBlank()) tasks
            else tasks.filter { it.title.contains(query, ignoreCase = true) }
        TaskListUiState.Success(tasks = filtered)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = TaskListUiState.Loading
    )

    fun onSearchQueryChange(query: String) {
        _searchQuery.value = query
    }
}
```

### Observing StateFlow in Compose

Always use `collectAsStateWithLifecycle()` — it stops collecting when the app is in the background:

```kotlin
@Composable
fun TaskListScreen(viewModel: TaskListViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()

    // Render based on uiState and searchQuery
}
```

Add this dependency: `androidx.lifecycle:lifecycle-runtime-compose`.

## UiState Pattern

### Sealed Interface for Screen States

```kotlin
sealed interface TaskListUiState {
    data object Loading : TaskListUiState
    data class Success(
        val tasks: List<Task> = emptyList(),
        val isRefreshing: Boolean = false
    ) : TaskListUiState
    data class Error(val message: String) : TaskListUiState
}
```

### One-Time Events (Snackbar, Navigation)

Don't put navigation or snackbar events in UiState — they're one-time actions, not persistent state. Use a `Channel`:

```kotlin
@HiltViewModel
class TaskListViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() {

    private val _events = Channel<TaskListEvent>(Channel.BUFFERED)
    val events: Flow<TaskListEvent> = _events.receiveAsFlow()

    fun deleteTask(task: Task) {
        viewModelScope.launch {
            repository.deleteTask(task)
            _events.send(TaskListEvent.ShowUndoSnackbar(task))
        }
    }
}

sealed interface TaskListEvent {
    data class ShowUndoSnackbar(val task: Task) : TaskListEvent
    data class NavigateToDetail(val taskId: Int) : TaskListEvent
}

// In the Composable:
LaunchedEffect(Unit) {
    viewModel.events.collect { event ->
        when (event) {
            is TaskListEvent.ShowUndoSnackbar -> {
                snackbarHostState.showSnackbar("Task deleted", actionLabel = "Undo")
            }
            is TaskListEvent.NavigateToDetail -> {
                onNavigateToDetail(event.taskId)
            }
        }
    }
}
```

## State Hoisting

Move state up to the lowest common ancestor that needs it. Pass state down, push events up:

```kotlin
// Parent owns the state
@Composable
fun TaskFormScreen(viewModel: TaskFormViewModel = hiltViewModel()) {
    val title by viewModel.title.collectAsStateWithLifecycle()
    val description by viewModel.description.collectAsStateWithLifecycle()

    TaskForm(
        title = title,                          // State flows down
        description = description,
        onTitleChange = viewModel::onTitleChange,  // Events flow up
        onDescriptionChange = viewModel::onDescriptionChange,
        onSubmit = viewModel::submit
    )
}

// Child is stateless — just renders and reports events
@Composable
fun TaskForm(
    title: String,
    description: String,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.padding(16.dp)) {
        OutlinedTextField(
            value = title,
            onValueChange = onTitleChange,
            label = { Text("Title") }
        )
        OutlinedTextField(
            value = description,
            onValueChange = onDescriptionChange,
            label = { Text("Description") }
        )
        Button(onClick = onSubmit) {
            Text("Save")
        }
    }
}
```

## Recomposition

### What Triggers Recomposition

- A `State` or `MutableState` value changes
- A `StateFlow` emits a new value (when observed with `collectAsStateWithLifecycle`)
- A parameter to a composable changes

### What Doesn't Trigger Recomposition

- Changing a regular variable (not `State`)
- Mutating an object in place (Compose tracks references, not deep equality)
- Side effects outside of `State`

### Avoiding Unnecessary Recomposition

```kotlin
// Bad: new lambda on every recomposition
LazyColumn {
    items(tasks) { task ->
        TaskItem(onClick = { onTaskClick(task.id) })  // New lambda each time
    }
}

// Better: stable lambda with method reference
LazyColumn {
    items(tasks, key = { it.id }) { task ->
        TaskItem(onClick = { onTaskClick(task.id) })
    }
}
// The key parameter helps Compose identify which items changed
```

### `derivedStateOf` for Computed Values

When a derived value changes less frequently than its inputs:

```kotlin
@Composable
fun TaskCounter(tasks: List<Task>) {
    // Recomputes only when the count actually changes, not on every list emission
    val completedCount by remember {
        derivedStateOf { tasks.count { it.isCompleted } }
    }

    Text("$completedCount of ${tasks.size} completed")
}
```

## Testing State

### Testing ViewModel StateFlow with Turbine

```kotlin
class TaskListViewModelTest {
    private val fakeRepository = FakeTaskRepository()
    private lateinit var viewModel: TaskListViewModel

    @BeforeEach
    fun setup() {
        viewModel = TaskListViewModel(fakeRepository)
    }

    @Test
    fun `initial state is loading then success`() = runTest {
        viewModel.uiState.test {
            // First emission: Loading
            assertEquals(TaskListUiState.Loading, awaitItem())

            // Second emission: Success with empty list
            val success = awaitItem()
            assertIs<TaskListUiState.Success>(success)
            assertTrue(success.tasks.isEmpty())

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `search filters tasks`() = runTest {
        fakeRepository.addTask("Buy milk")
        fakeRepository.addTask("Buy eggs")
        fakeRepository.addTask("Walk dog")

        viewModel.uiState.test {
            skipItems(1)  // Skip Loading
            val allTasks = awaitItem()
            assertIs<TaskListUiState.Success>(allTasks)
            assertEquals(3, allTasks.tasks.size)

            viewModel.onSearchQueryChange("Buy")

            val filtered = awaitItem()
            assertIs<TaskListUiState.Success>(filtered)
            assertEquals(2, filtered.tasks.size)

            cancelAndIgnoreRemainingEvents()
        }
    }
}
```

### Testing Compose UI State

```kotlin
@Test
fun taskItem_displaysCorrectly() {
    composeTestRule.setContent {
        MyAppTheme {
            TaskItem(
                task = Task(title = "Test task", isCompleted = false),
                onToggle = {},
                onDelete = {},
                onClick = {}
            )
        }
    }

    composeTestRule.onNodeWithText("Test task").assertIsDisplayed()
    composeTestRule.onNode(isToggleable()).assertIsOff()
}
```
