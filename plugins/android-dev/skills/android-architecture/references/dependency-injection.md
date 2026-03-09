# Dependency Injection with Hilt

## Why Dependency Injection?

Without DI, classes create their own dependencies, leading to tight coupling:

```kotlin
// Bad: ViewModel creates its own repository
class TaskViewModel : ViewModel() {
    private val repository = TaskRepository(AppDatabase.getInstance().taskDao())
    // Can't test with a fake repository
}
```

With DI, dependencies are provided from outside:

```kotlin
// Good: Repository injected by Hilt
@HiltViewModel
class TaskViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() {
    // Easy to test with a fake repository
}
```

## Hilt Setup

### 1. Application Class

```kotlin
@HiltAndroidApp
class MyApp : Application()
```

Register in `AndroidManifest.xml`:

```xml
<application android:name=".MyApp" ...>
```

### 2. Activity

```kotlin
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyAppTheme {
                AppNavigation()
            }
        }
    }
}
```

### 3. ViewModel

```kotlin
@HiltViewModel
class TaskListViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() {
    // Hilt provides the repository automatically
}
```

In Compose, use `hiltViewModel()`:

```kotlin
@Composable
fun TaskListScreen(
    viewModel: TaskListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // ...
}
```

## Hilt Modules

Modules tell Hilt how to provide dependencies it can't construct automatically (interfaces, third-party classes, configured instances).

### Database Module

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "app_database"
        ).build()
    }

    @Provides
    fun provideTaskDao(database: AppDatabase): TaskDao {
        return database.taskDao()
    }
}
```

### Network Module

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://api.example.com/")
            .client(okHttpClient)
            .addConverterFactory(Json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    fun provideTaskApi(retrofit: Retrofit): TaskApi {
        return retrofit.create(TaskApi::class.java)
    }
}
```

### Binding Interfaces

When you have an interface with one implementation:

```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindTaskRepository(
        impl: TaskRepositoryImpl
    ): TaskRepository
}
```

The implementation class uses `@Inject constructor`:

```kotlin
class TaskRepositoryImpl @Inject constructor(
    private val taskDao: TaskDao,
    private val taskApi: TaskApi
) : TaskRepository {
    // implementation
}
```

## Scoping

| Scope | Annotation | Lifetime | Use For |
|---|---|---|---|
| **Singleton** | `@Singleton` / `@InstallIn(SingletonComponent)` | App lifetime | Database, Retrofit, Repositories |
| **ViewModel** | `@InstallIn(ViewModelComponent)` | ViewModel lifetime | Use cases specific to a screen |
| **Activity** | `@InstallIn(ActivityComponent)` | Activity lifetime | Rarely needed with Compose |
| **Fragment** | `@InstallIn(FragmentComponent)` | Fragment lifetime | Legacy — not used with Compose |

**Rule of thumb**: Use `SingletonComponent` for most modules. Only scope to `ViewModelComponent` if the dependency should be recreated per ViewModel instance.

## Qualifiers

When Hilt needs to distinguish between multiple instances of the same type:

```kotlin
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class IoDispatcher

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class DefaultDispatcher

@Module
@InstallIn(SingletonComponent::class)
object DispatcherModule {

    @IoDispatcher
    @Provides
    fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

    @DefaultDispatcher
    @Provides
    fun provideDefaultDispatcher(): CoroutineDispatcher = Dispatchers.Default
}

// Usage
class TaskRepository @Inject constructor(
    private val taskDao: TaskDao,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) {
    suspend fun refreshTasks() = withContext(ioDispatcher) {
        // ...
    }
}
```

## Testing with Hilt

### Unit Tests (No Hilt)

For unit testing ViewModels, don't use Hilt — just pass fakes:

```kotlin
class TaskListViewModelTest {
    private val fakeRepository = FakeTaskRepository()
    private lateinit var viewModel: TaskListViewModel

    @BeforeEach
    fun setup() {
        viewModel = TaskListViewModel(fakeRepository)
    }

    @Test
    fun `adding task updates state`() = runTest {
        viewModel.addTask("Test task")

        val state = viewModel.uiState.first()
        assertIs<TaskListUiState.Success>(state)
        assertEquals(1, state.tasks.size)
    }
}
```

### Integration Tests (With Hilt)

For integration tests that need real DI:

```kotlin
@HiltAndroidTest
@UninstallModules(DatabaseModule::class)
class TaskListIntegrationTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @Module
    @InstallIn(SingletonComponent::class)
    object TestDatabaseModule {
        @Provides
        @Singleton
        fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
            return Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        }
    }

    @Inject
    lateinit var repository: TaskRepository

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun addAndRetrieveTask() = runTest {
        repository.addTask("Integration test task")
        val tasks = repository.getAllTasks().first()
        assertEquals(1, tasks.size)
    }
}
```

## Common Hilt Mistakes

| Mistake | Error Message | Fix |
|---|---|---|
| Missing `@HiltAndroidApp` | `Hilt Activity must be attached to an @HiltAndroidApp Application` | Add annotation to Application class |
| Missing `@AndroidEntryPoint` | `...has not been transformed by Hilt` | Add annotation to Activity |
| Missing `@Inject constructor` | `cannot be provided without an @Inject constructor or an @Provides-annotated method` | Add `@Inject constructor` to the class |
| Wrong scope | Singleton injected into ViewModel scope | Match the component scope to the dependency lifetime |
| Missing module installation | `MissingBinding` error | Ensure module has `@InstallIn` with correct component |
| Using `kapt` instead of `ksp` | Slower builds, potential errors | Migrate to KSP for Hilt 2.48+ |
