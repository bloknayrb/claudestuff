# Android Troubleshooting Guide

## Gradle Sync Failures

### "Could not resolve" dependency

**Symptoms**: Red error in build output mentioning a specific library.

**Common causes and fixes**:

1. **Missing repository**: Ensure `settings.gradle.kts` has:
   ```kotlin
   dependencyResolutionManagement {
       repositories {
           google()          // For AndroidX, Compose, Hilt
           mavenCentral()    // For most other libraries
       }
   }
   ```

2. **Wrong version**: Check the library's release page for available versions. Version catalog typos are common — verify in `libs.versions.toml`.

3. **Network/proxy issue**: Try `File → Invalidate Caches → Invalidate and Restart`, then sync again.

### "Failed to find Build Tools revision X.Y.Z"

**Fix**: Open SDK Manager (`Tools → SDK Manager`), go to SDK Tools tab, and install the required Build Tools version. Or update `buildToolsVersion` in `build.gradle.kts` to match an installed version.

### "Unsupported class file major version 65" (or similar)

**Cause**: JDK version mismatch. Your project expects a different JDK than what's configured.

**Fix**: `File → Project Structure → SDK Location → Gradle JDK` — select the bundled JDK (JBR 17 or 21) or the version your project requires.

### Gradle sync takes forever

**Fixes**:
1. Enable Gradle build cache: Add to `gradle.properties`:
   ```properties
   org.gradle.caching=true
   org.gradle.parallel=true
   org.gradle.configureondemand=true
   ```
2. Use `--offline` mode if you don't need new dependencies: `File → Settings → Build → Gradle → Offline work`
3. Check if a corporate proxy is blocking downloads

## Build Errors

### "Unresolved reference" after adding dependency

**Cause**: Gradle files are out of sync with your code.

**Fix**: Click "Sync Now" in the Gradle notification bar, or `File → Sync Project with Gradle Files`. If that doesn't work, try `Build → Clean Project` then `Build → Rebuild Project`.

### "Duplicate class" error

**Cause**: Two libraries include the same class (transitive dependency conflict).

**Debug**: Run in terminal:
```bash
./gradlew :app:dependencies --configuration runtimeClasspath | grep -i "conflicting-package"
```

**Fix**: Exclude the duplicate from one dependency:
```kotlin
implementation("com.example:library:1.0") {
    exclude(group = "com.conflicting", module = "module-name")
}
```

### "Execution failed for task :app:kspDebugKotlin"

**Cause**: KSP processor version doesn't match Kotlin version.

**Fix**: KSP version must match Kotlin version. For Kotlin `2.1.0`, use KSP `2.1.0-1.0.29` (format: `kotlinVersion-kspVersion`). Check the [KSP releases](https://github.com/google/ksp/releases) for the matching version.

### Out of Memory during build

**Fix**: Increase Gradle JVM heap in `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g
```

For large projects with many modules, 4-6GB is reasonable.

## Runtime Crashes

### App crashes on rotation

**Symptom**: `IllegalStateException` or state is lost when rotating the device.

**Cause**: State stored in `remember` doesn't survive configuration changes.

**Fix**: Move state to ViewModel:
```kotlin
// Before (broken on rotation):
var count by remember { mutableStateOf(0) }

// After (survives rotation):
// In ViewModel:
private val _count = MutableStateFlow(0)
val count: StateFlow<Int> = _count.asStateFlow()
```

### `NetworkOnMainThreadException`

**Cause**: Making a network call on the main (UI) thread.

**Fix**: Use coroutines with `Dispatchers.IO`:
```kotlin
// In Repository:
suspend fun fetchData(): Result<Data> = withContext(Dispatchers.IO) {
    api.getData()
}

// In ViewModel:
viewModelScope.launch {
    val result = repository.fetchData()  // Runs on IO thread
}
```

### `android.view.InflateException` or `ClassNotFoundException`

**Common causes**:
1. Missing `@AndroidEntryPoint` on Activity (if using Hilt)
2. Missing `@HiltAndroidApp` on Application class
3. ProGuard/R8 stripping a class that's needed at runtime

### `java.lang.IllegalStateException: Activity has been destroyed`

**Cause**: Trying to update UI after the Activity is gone (leaked coroutine or callback).

**Fix**: Use lifecycle-aware coroutine scopes (`viewModelScope`, `lifecycleScope`) and `collectAsStateWithLifecycle()`.

### Compose: "Too many recompositions"

**Cause**: Infinite recomposition loop — a composable triggers a state change that triggers itself.

**Debug**: Enable Composition Tracing in Android Studio (`Run → Edit Configurations → Profiling → Enable Compose Tracing`).

**Common causes**:
```kotlin
// Bad: Side effect in composition creates infinite loop
@Composable
fun Bad() {
    var count by remember { mutableStateOf(0) }
    count++  // Triggers recomposition, which runs count++ again...
}

// Good: Side effects in LaunchedEffect
@Composable
fun Good() {
    var count by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        count++  // Runs once
    }
}
```

## Emulator Issues

### Emulator won't start

**Check these in order**:

1. **Virtualization enabled**: Check BIOS for Intel VT-x or AMD-V/SVM. On Windows, also check that Hyper-V or Windows Hypervisor Platform is enabled.

2. **Enough disk space**: Emulator images are 2-6 GB each. Free up space or change the AVD storage location.

3. **Graphics driver**: Try switching graphics mode:
   - Device Manager → Edit (pencil icon) → Show Advanced Settings → Emulated Performance → Graphics
   - Try "Software" if "Automatic" or "Hardware" fails

4. **Conflicting hypervisors**: VirtualBox, VMware, and Docker Desktop can conflict with the Android Emulator on Windows. Close them and try again.

### Emulator is extremely slow

**Fixes**:
1. Use an x86_64 system image (not ARM) on Intel/AMD machines
2. Allocate more RAM to the AVD (2-4 GB)
3. Enable hardware acceleration (HAXM on Intel, Hypervisor on AMD)
4. Close other heavy apps (Docker, VMs)
5. Consider using a physical device for testing — it's often faster

### App installs but doesn't run

**Check**:
- Logcat for crash messages (filter by your package name)
- `minSdk` in build.gradle.kts vs emulator API level
- Internet permission in manifest if the app needs network

## ProGuard / R8 Issues

### App works in debug but crashes in release

**Cause**: R8 (Android's code shrinker) removed or renamed a class that's accessed by reflection.

**Debug**: Look at the crash log for `ClassNotFoundException` or `NoSuchMethodException`.

**Fix**: Add keep rules in `proguard-rules.pro`:
```proguard
# Keep data classes used with Kotlin Serialization
-keep class com.example.myapp.data.** { *; }

# Keep Retrofit interfaces
-keep,allowobfuscation interface com.example.myapp.data.remote.** { *; }

# Common: keep all @Serializable classes
-keepclassmembers class * {
    @kotlinx.serialization.Serializable *;
}
```

### How to debug R8 issues

1. Build release APK: `./gradlew assembleRelease`
2. Check `app/build/outputs/mapping/release/mapping.txt` for what was renamed
3. Use `retrace` to decode obfuscated stack traces
4. Enable `minifyEnabled = false` temporarily to confirm R8 is the issue

## Debugging Tips

### Logcat Filters

```
# Filter by your app
package:com.example.myapp

# Filter by tag
tag:MyViewModel

# Filter errors only
level:error

# Combine filters
package:com.example.myapp level:error
```

### Layout Inspector

`Tools → Layout Inspector` — shows the Compose tree at runtime. Useful for:
- Seeing actual sizes and padding
- Checking recomposition counts
- Verifying Modifier order

### Network Inspector

`View → Tool Windows → App Inspection → Network Inspector` — shows all HTTP traffic. Useful for verifying API calls, checking headers, and debugging response parsing.

### Build Analyzer

`Build → Analyze Build` after a build completes — shows what took the most time. Useful for identifying slow plugins, tasks, or configuration.
