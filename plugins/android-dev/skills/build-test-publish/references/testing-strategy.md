# Android Testing Strategy

## Testing Pyramid

```
        /  UI Tests  \        ~10% — Compose UI tests, critical user flows
       / Integration  \       ~20% — ViewModel + Repository, Room DAO tests
      /   Unit Tests   \      ~70% — Pure logic, ViewModels, mappers, use cases
```

These ratios are starting guidelines. Adjust based on your app — a heavily UI-driven app might have more UI tests, while a data-processing app might lean heavier on unit tests.

## Unit Tests

### Setup

Testing dependencies in `build.gradle.kts`:

```kotlin
testImplementation(libs.junit5)
testImplementation(libs.mockk)
testImplementation(libs.turbine)
testImplementation(libs.kotlinx.coroutines.test)
```

Enable JUnit 5 in `build.gradle.kts`:

```kotlin
tasks.withType<Test> {
    useJUnitPlatform()
}
```

### Testing a ViewModel

```kotlin
class TaskListViewModelTest {
    private lateinit var viewModel: TaskListViewModel
    private lateinit var fakeRepository: FakeTaskRepository

    @BeforeEach
    fun setup() {
        fakeRepository = FakeTaskRepository()
        viewModel = TaskListViewModel(fakeRepository)
    }

    @Test
    fun `initial state is loading`() = runTest {
        viewModel.uiState.test {
            assertEquals(TaskListUiState.Loading, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `adding a task updates the list`() = runTest {
        viewModel.uiState.test {
            skipItems(1)  // Skip Loading

            // Should start empty
            val empty = awaitItem()
            assertIs<TaskListUiState.Success>(empty)
            assertTrue(empty.tasks.isEmpty())

            // Add a task
            viewModel.addTask("Buy groceries")

            // Should now have one task
            val withTask = awaitItem()
            assertIs<TaskListUiState.Success>(withTask)
            assertEquals(1, withTask.tasks.size)
            assertEquals("Buy groceries", withTask.tasks.first().title)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `toggling task updates completion status`() = runTest {
        fakeRepository.addTask("Test task")

        viewModel.uiState.test {
            skipItems(1)  // Skip Loading

            val initial = awaitItem()
            assertIs<TaskListUiState.Success>(initial)
            assertFalse(initial.tasks.first().isCompleted)

            viewModel.toggleTaskCompletion(initial.tasks.first())

            val updated = awaitItem()
            assertIs<TaskListUiState.Success>(updated)
            assertTrue(updated.tasks.first().isCompleted)

            cancelAndIgnoreRemainingEvents()
        }
    }
}
```

### Creating Fake Repositories

```kotlin
class FakeTaskRepository : TaskRepository {
    private val tasks = MutableStateFlow<List<Task>>(emptyList())
    private var nextId = 1

    override fun getAllTasks(): Flow<List<Task>> = tasks

    override fun getTaskById(id: Int): Flow<Task?> = tasks.map { list ->
        list.find { it.id == id }
    }

    override suspend fun addTask(title: String, description: String) {
        val task = Task(id = nextId++, title = title, description = description)
        tasks.update { it + task }
    }

    override suspend fun toggleTaskCompletion(task: Task) {
        tasks.update { list ->
            list.map { if (it.id == task.id) it.copy(isCompleted = !it.isCompleted) else it }
        }
    }

    override suspend fun deleteTask(task: Task) {
        tasks.update { list -> list.filter { it.id != task.id } }
    }
}
```

### Testing with MockK

When fakes are too much work, use MockK:

```kotlin
class GetSortedTasksUseCaseTest {
    private val repository = mockk<TaskRepository>()
    private lateinit var useCase: GetSortedTasksUseCase

    @BeforeEach
    fun setup() {
        useCase = GetSortedTasksUseCase(repository)
    }

    @Test
    fun `sorts tasks by title`() = runTest {
        val tasks = listOf(
            Task(id = 1, title = "Zebra"),
            Task(id = 2, title = "Apple"),
            Task(id = 3, title = "Mango")
        )
        every { repository.getAllTasks() } returns flowOf(tasks)

        useCase(SortOrder.TITLE).test {
            val sorted = awaitItem()
            assertEquals("Apple", sorted[0].title)
            assertEquals("Mango", sorted[1].title)
            assertEquals("Zebra", sorted[2].title)
            awaitComplete()
        }
    }
}
```

## Integration Tests

### Testing Room DAOs

```kotlin
class TaskDaoTest {
    private lateinit var database: AppDatabase
    private lateinit var dao: TaskDao

    @BeforeEach
    fun setup() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).allowMainThreadQueries().build()

        dao = database.taskDao()
    }

    @AfterEach
    fun teardown() {
        database.close()
    }

    @Test
    fun insertAndRetrieveTask() = runTest {
        val task = Task(title = "Test task")
        dao.insertTask(task)

        dao.getAllTasks().test {
            val tasks = awaitItem()
            assertEquals(1, tasks.size)
            assertEquals("Test task", tasks.first().title)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun deleteTaskRemovesFromList() = runTest {
        val task = Task(id = 1, title = "Delete me")
        dao.insertTask(task)
        dao.deleteTask(task)

        dao.getAllTasks().test {
            val tasks = awaitItem()
            assertTrue(tasks.isEmpty())
            cancelAndIgnoreRemainingEvents()
        }
    }
}
```

### Testing ViewModel with Real Repository (Hilt)

```kotlin
@HiltAndroidTest
@UninstallModules(DatabaseModule::class)
class TaskListIntegrationTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @Module
    @InstallIn(SingletonComponent::class)
    object TestDatabaseModule {
        @Provides
        @Singleton
        fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
            return Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        }
    }

    @Inject lateinit var repository: TaskRepository

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun fullTaskLifecycle() = runTest {
        // Create
        repository.addTask("Integration task")
        val tasks = repository.getAllTasks().first()
        assertEquals(1, tasks.size)

        // Toggle
        repository.toggleTaskCompletion(tasks.first())
        val updated = repository.getAllTasks().first()
        assertTrue(updated.first().isCompleted)

        // Delete
        repository.deleteTask(updated.first())
        val empty = repository.getAllTasks().first()
        assertTrue(empty.isEmpty())
    }
}
```

## UI Tests (Compose Testing)

### Setup

```kotlin
androidTestImplementation(libs.compose.ui.test.junit4)
debugImplementation(libs.compose.ui.test.manifest)
```

### Testing a Composable

```kotlin
class TaskItemTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun displaysTaskTitle() {
        composeRule.setContent {
            MyAppTheme {
                TaskItem(
                    task = Task(title = "Buy groceries", isCompleted = false),
                    onToggle = {},
                    onDelete = {},
                    onClick = {}
                )
            }
        }

        composeRule.onNodeWithText("Buy groceries").assertIsDisplayed()
    }

    @Test
    fun checkboxReflectsCompletionState() {
        composeRule.setContent {
            MyAppTheme {
                TaskItem(
                    task = Task(title = "Completed task", isCompleted = true),
                    onToggle = {},
                    onDelete = {},
                    onClick = {}
                )
            }
        }

        composeRule.onNode(isToggleable()).assertIsOn()
    }

    @Test
    fun clickingCheckboxCallsOnToggle() {
        var toggled = false
        composeRule.setContent {
            MyAppTheme {
                TaskItem(
                    task = Task(title = "Toggle me"),
                    onToggle = { toggled = true },
                    onDelete = {},
                    onClick = {}
                )
            }
        }

        composeRule.onNode(isToggleable()).performClick()
        assertTrue(toggled)
    }
}
```

### Testing a Screen with UiState

```kotlin
class TaskListScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun loadingStateShowsProgressIndicator() {
        composeRule.setContent {
            MyAppTheme {
                TaskListContent(
                    uiState = TaskListUiState.Loading,
                    onAddTask = {},
                    onToggleTask = {},
                    onTaskClick = {}
                )
            }
        }

        composeRule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate))
            .assertIsDisplayed()
    }

    @Test
    fun emptyStateShowsMessage() {
        composeRule.setContent {
            MyAppTheme {
                TaskListContent(
                    uiState = TaskListUiState.Success(tasks = emptyList()),
                    onAddTask = {},
                    onToggleTask = {},
                    onTaskClick = {}
                )
            }
        }

        composeRule.onNodeWithText("No tasks yet", substring = true).assertIsDisplayed()
    }

    @Test
    fun successStateShowsTasks() {
        val tasks = listOf(
            Task(id = 1, title = "Task 1"),
            Task(id = 2, title = "Task 2")
        )

        composeRule.setContent {
            MyAppTheme {
                TaskListContent(
                    uiState = TaskListUiState.Success(tasks = tasks),
                    onAddTask = {},
                    onToggleTask = {},
                    onTaskClick = {}
                )
            }
        }

        composeRule.onNodeWithText("Task 1").assertIsDisplayed()
        composeRule.onNodeWithText("Task 2").assertIsDisplayed()
    }
}
```

## What to Test

| Layer | What to Test | What NOT to Test |
|---|---|---|
| **ViewModel** | State transitions, event handling, error cases | Compose framework behavior |
| **Repository** | Data transformation, offline fallback, error handling | Room/Retrofit internals |
| **DAO** | Queries return correct data, constraints work | Room library itself |
| **UI** | User-visible behavior, accessibility, critical flows | Internal implementation details |
| **Use Cases** | Business logic, edge cases | Framework integration |

## Running Tests

```bash
# Unit tests (fast, JVM-only)
./gradlew test

# Instrumented tests (requires device/emulator)
./gradlew connectedAndroidTest

# Specific test class
./gradlew test --tests "com.example.TaskListViewModelTest"

# With coverage report
./gradlew testDebugUnitTest jacocoTestReport
```
