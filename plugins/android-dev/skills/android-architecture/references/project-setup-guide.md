# New Android Project Setup Guide

Step-by-step walkthrough for creating a new Android project with modern tooling.

## Prerequisites

### Android Studio Installation

1. Download Android Studio from the [official site](https://developer.android.com/studio)
2. Run the installer — accept default settings for first-time setup
3. During first launch, the Setup Wizard will download:
   - Android SDK (latest stable)
   - Android SDK Build-Tools
   - Android Emulator
   - Intel HAXM or Android Emulator Hypervisor (for emulator acceleration)
4. Wait for all downloads to complete before creating a project

**If Android Studio won't launch**: Ensure you have JDK 17+ installed. Android Studio bundles one, but environment conflicts can cause issues. Check `File → Project Structure → SDK Location`.

### Emulator Setup

1. Open **Device Manager** (toolbar icon or `Tools → Device Manager`)
2. Click **Create Device**
3. Choose a phone profile (Pixel 8 is a good default)
4. Select a system image — choose the latest stable API level with Google Play
5. Accept defaults for RAM and storage
6. Click **Finish** and launch the emulator to verify it works

**Emulator won't start?** Check BIOS for Intel VT-x or AMD-V virtualization. If that's not available, use a physical device connected via USB with Developer Options enabled.

## Creating the Project

### In Android Studio

1. **File → New → New Project**
2. Choose **Empty Activity** (this creates a Compose project — the "Empty Views Activity" template is the old XML approach)
3. Configure:
   - **Name**: Your app name (e.g., "My Todo App")
   - **Package name**: Reverse domain (e.g., `com.yourname.mytodoapp`)
   - **Save location**: Your preferred directory
   - **Language**: Kotlin (only option for Compose templates)
   - **Minimum SDK**: API 26 is a good default (covers ~95% of devices)
   - **Build configuration language**: Kotlin DSL (recommended)
4. Click **Finish** and wait for Gradle sync to complete

### What Android Studio Generated

```
app/
├── src/
│   ├── main/
│   │   ├── java/com/yourname/mytodoapp/
│   │   │   ├── MainActivity.kt      # Entry point
│   │   │   └── ui/theme/
│   │   │       ├── Color.kt          # Material 3 color definitions
│   │   │       ├── Theme.kt          # Theme composable with dynamic color
│   │   │       └── Type.kt           # Typography definitions
│   │   ├── res/
│   │   │   ├── values/strings.xml    # App name and string resources
│   │   │   └── ...                   # Other resources
│   │   └── AndroidManifest.xml       # App declaration, permissions
│   └── test/                         # Unit tests
│       └── ...
├── build.gradle.kts                  # Module-level build config
└── ...
gradle/
├── libs.versions.toml                # Version catalog
└── wrapper/
    └── gradle-wrapper.properties     # Gradle version
build.gradle.kts                      # Project-level build config
settings.gradle.kts                   # Module declarations, repositories
```

## Expanding to MVVM

The generated project puts everything in `MainActivity`. Here's how to restructure for a real app:

### Step 1: Add Dependencies

In `gradle/libs.versions.toml`, add:

> **Version freshness**: The versions below were current as of early 2025. Before starting a new project, check [Google's Maven Repository](https://maven.google.com) or use Android Studio's dependency update suggestions to get the latest stable versions.

```toml
[versions]
hilt = "2.51.1"
hilt-navigation-compose = "1.2.0"
lifecycle = "2.8.7"
navigation = "2.8.9"
room = "2.6.1"
ksp = "2.1.0-1.0.29"

[libraries]
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version.ref = "hilt-navigation-compose" }
lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }
room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }

[plugins]
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

### Step 2: Apply Plugins

In `app/build.gradle.kts`:

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

// In dependencies block, add:
dependencies {
    // ... existing Compose dependencies ...

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Lifecycle
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)

    // Navigation
    implementation(libs.navigation.compose)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
}
```

Also apply the Hilt and KSP plugins in the project-level `build.gradle.kts`:

```kotlin
plugins {
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.ksp) apply false
}
```

### Step 3: Create Package Structure

Create the directory structure from the architecture SKILL.md:

```
com.yourname.mytodoapp/
├── data/
│   ├── local/
│   ├── remote/        # (if using network)
│   └── repository/
├── di/
├── ui/
│   ├── components/
│   ├── navigation/
│   ├── screens/
│   └── theme/         # (already exists)
└── MyApp.kt           # Application class for Hilt
```

### Step 4: Initialize Hilt

Create `MyApp.kt`:

```kotlin
@HiltAndroidApp
class MyApp : Application()
```

Add to `AndroidManifest.xml`:

```xml
<application
    android:name=".MyApp"
    ... >
```

Annotate `MainActivity`:

```kotlin
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    // ...
}
```

### Step 5: Sync and Verify

1. Click **Sync Now** in the Gradle notification bar
2. Build the project (`Build → Make Project`)
3. Run on emulator or device to verify the template still works
4. You're now ready to start building features

## Running and Debugging

### Run the App

- **Emulator**: Select device in toolbar dropdown → click Run (green play button) or `Shift+F10`
- **Physical device**: Enable Developer Options + USB Debugging → connect via USB → select device → Run

### Logcat (Console Output)

- Open **Logcat** panel at the bottom of Android Studio
- Filter by your app's package name
- Use `Log.d("TAG", "message")` for debug logging
- Filter by log level (Verbose, Debug, Info, Warning, Error)

### Debugger

- Set breakpoints by clicking the gutter next to line numbers
- Click **Debug** (bug icon) instead of Run
- Use **Evaluate Expression** (`Alt+F8`) to inspect values at breakpoints

## Version Considerations

- **`compileSdk`**: Use the latest stable SDK — this determines which APIs you can call
- **`targetSdk`**: Should match `compileSdk` for new projects; determines runtime behavior
- **`minSdk`**: Lowest API level you support — API 26 covers ~95% of devices
- Keep `compileSdk` and `targetSdk` updated annually — Google Play requires rolling target SDK updates
