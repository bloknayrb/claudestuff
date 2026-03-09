# Architecture Patterns

## MVVM (Model-View-ViewModel)

The recommended architecture for most Android apps. Separates concerns into three layers:

- **View** (Composables): Renders UI based on state, sends user events to ViewModel
- **ViewModel**: Holds UI state, processes events, calls data layer
- **Model** (Repository + Data Sources): Provides data from network, database, or other sources

### Data Flow

```
User Action → Composable → ViewModel → Repository → DataSource
                ↑                          ↓
            StateFlow ← ViewModel ← Repository
```

This is **unidirectional data flow (UDF)**: state flows down, events flow up.

### Complete MVVM Example: Task List

**Entity (Room database model)**:

```kotlin
@Entity(tableName = "tasks")
data class Task(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val title: String,
    val description: String = "",
    val isCompleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
```

**DAO (Data Access Object)**:

```kotlin
@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY createdAt DESC")
    fun getAllTasks(): Flow<List<Task>>

    @Insert
    suspend fun insertTask(task: Task)

    @Update
    suspend fun updateTask(task: Task)

    @Delete
    suspend fun deleteTask(task: Task)

    @Query("SELECT * FROM tasks WHERE id = :id")
    fun getTaskById(id: Int): Flow<Task?>
}
```

**Database**:

```kotlin
@Database(entities = [Task::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
}
```

**Repository**:

```kotlin
class TaskRepository @Inject constructor(
    private val taskDao: TaskDao
) {
    fun getAllTasks(): Flow<List<Task>> = taskDao.getAllTasks()

    fun getTaskById(id: Int): Flow<Task?> = taskDao.getTaskById(id)

    suspend fun addTask(title: String, description: String = "") {
        taskDao.insertTask(Task(title = title, description = description))
    }

    suspend fun toggleTaskCompletion(task: Task) {
        taskDao.updateTask(task.copy(isCompleted = !task.isCompleted))
    }

    suspend fun deleteTask(task: Task) {
        taskDao.deleteTask(task)
    }
}
```

**UiState**:

```kotlin
sealed interface TaskListUiState {
    data object Loading : TaskListUiState
    data class Success(
        val tasks: List<Task> = emptyList()
    ) : TaskListUiState
    data class Error(val message: String) : TaskListUiState
}
```

**ViewModel**:

```kotlin
@HiltViewModel
class TaskListViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() {

    val uiState: StateFlow<TaskListUiState> = repository.getAllTasks()
        .map<List<Task>, TaskListUiState> { tasks ->
            TaskListUiState.Success(tasks = tasks)
        }
        .catch { e ->
            emit(TaskListUiState.Error(e.message ?: "Unknown error"))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = TaskListUiState.Loading
        )

    fun addTask(title: String, description: String = "") {
        viewModelScope.launch {
            repository.addTask(title, description)
        }
    }

    fun toggleTaskCompletion(task: Task) {
        viewModelScope.launch {
            repository.toggleTaskCompletion(task)
        }
    }

    fun deleteTask(task: Task) {
        viewModelScope.launch {
            repository.deleteTask(task)
        }
    }
}
```

**Screen Composable**:

```kotlin
@Composable
fun TaskListScreen(
    viewModel: TaskListViewModel = hiltViewModel(),
    onNavigateToDetail: (Int) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    TaskListContent(
        uiState = uiState,
        onAddTask = viewModel::addTask,
        onToggleTask = viewModel::toggleTaskCompletion,
        onDeleteTask = viewModel::deleteTask,
        onTaskClick = { task -> onNavigateToDetail(task.id) }
    )
}

@Composable
private fun TaskListContent(
    uiState: TaskListUiState,
    onAddTask: (String, String) -> Unit,
    onToggleTask: (Task) -> Unit,
    onDeleteTask: (Task) -> Unit,
    onTaskClick: (Task) -> Unit
) {
    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { /* show add dialog */ }) {
                Icon(Icons.Default.Add, contentDescription = "Add task")
            }
        }
    ) { paddingValues ->
        when (uiState) {
            is TaskListUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is TaskListUiState.Success -> {
                if (uiState.tasks.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize().padding(paddingValues),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No tasks yet. Tap + to add one!")
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(paddingValues),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(
                            items = uiState.tasks,
                            key = { it.id }
                        ) { task ->
                            TaskItem(
                                task = task,
                                onToggle = { onToggleTask(task) },
                                onDelete = { onDeleteTask(task) },
                                onClick = { onTaskClick(task) }
                            )
                        }
                    }
                }
            }
            is TaskListUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Error: ${uiState.message}",
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}
```

### Why MVVM Works Well for Android

- **Lifecycle-aware**: ViewModel survives configuration changes (rotation)
- **Testable**: ViewModel can be tested without Android framework
- **Separation of concerns**: UI, business logic, and data access are independent
- **Compose-friendly**: StateFlow maps naturally to Compose's reactive model

## Clean Architecture (When You Need It)

Clean Architecture adds a **domain layer** between the ViewModel and Repository. Use it when:
- Multiple ViewModels share the same business logic
- Business rules are complex and need isolated testing
- You're building a multi-module app with clear boundaries

### Additional Layer: Use Cases

```kotlin
class GetSortedTasksUseCase @Inject constructor(
    private val repository: TaskRepository
) {
    operator fun invoke(sortBy: SortOrder = SortOrder.DATE): Flow<List<Task>> {
        return repository.getAllTasks().map { tasks ->
            when (sortBy) {
                SortOrder.DATE -> tasks.sortedByDescending { it.createdAt }
                SortOrder.TITLE -> tasks.sortedBy { it.title }
                SortOrder.COMPLETED -> tasks.sortedBy { it.isCompleted }
            }
        }
    }
}

enum class SortOrder { DATE, TITLE, COMPLETED }
```

**ViewModel using Use Cases**:

```kotlin
@HiltViewModel
class TaskListViewModel @Inject constructor(
    private val getSortedTasks: GetSortedTasksUseCase,
    private val toggleTaskCompletion: ToggleTaskCompletionUseCase,
    private val deleteTask: DeleteTaskUseCase
) : ViewModel() {
    // Use cases instead of repository directly
}
```

### When NOT to Use Clean Architecture

- Apps with < 5 screens — the extra layer adds boilerplate without benefit
- Rapid prototyping — use simple MVVM first, refactor to Clean if needed
- Solo developer or small team — the indirection slows down development early on

## Repository Pattern

The Repository is the single source of truth for data. It coordinates between network and local storage:

```kotlin
class TaskRepository @Inject constructor(
    private val taskDao: TaskDao,
    private val taskApi: TaskApi  // Remote data source
) {
    // Local-first: always return from database, sync in background
    fun getAllTasks(): Flow<List<Task>> = taskDao.getAllTasks()

    suspend fun refreshTasks() {
        val remoteTasks = taskApi.getTasks()
        taskDao.insertAll(remoteTasks.map { it.toEntity() })
    }

    suspend fun addTask(title: String, description: String) {
        val task = Task(title = title, description = description)
        taskDao.insertTask(task)
        // Optionally sync to remote
        try {
            taskApi.createTask(task.toDto())
        } catch (e: Exception) {
            // Handle offline — task is already saved locally
        }
    }
}
```

### Offline-First Strategy

1. Always write to local database first
2. Return `Flow` from Room — UI updates automatically
3. Sync to remote in background
4. Handle network errors gracefully — the app works offline
5. Use `WorkManager` for reliable background sync

## Multi-Module Architecture

For larger apps, split into Gradle modules:

```
:app                    # Application module, navigation, DI wiring
:feature:task-list      # Task list screen + ViewModel
:feature:task-detail    # Task detail screen + ViewModel
:core:data              # Repositories, data sources
:core:database          # Room database, DAOs, entities
:core:network           # Retrofit services, DTOs
:core:model             # Shared domain models
:core:ui                # Shared Compose components, theme
```

Benefits: faster builds (parallel compilation), enforced boundaries, feature-level ownership.

Only do this when your app outgrows a single module — typically 10+ screens or multiple developers.
