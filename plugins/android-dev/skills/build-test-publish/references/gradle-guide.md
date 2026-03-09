# Gradle Build Configuration Guide

## Project Structure

A typical Android project has these Gradle files:

```
project-root/
├── build.gradle.kts           # Project-level: plugin declarations
├── settings.gradle.kts        # Module list, repository configuration
├── gradle.properties          # Build settings (JVM args, feature flags)
├── gradle/
│   ├── libs.versions.toml     # Version catalog (single source of truth for versions)
│   └── wrapper/
│       └── gradle-wrapper.properties  # Gradle version
└── app/
    └── build.gradle.kts       # Module-level: dependencies, SDK config, build types
```

## Version Catalogs

The version catalog (`gradle/libs.versions.toml`) centralizes all dependency versions:

```toml
[versions]
agp = "8.7.3"
kotlin = "2.1.0"
compose-bom = "2025.01.01"
hilt = "2.51.1"
ksp = "2.1.0-1.0.29"
lifecycle = "2.8.7"
room = "2.6.1"
retrofit = "2.11.0"
okhttp = "4.12.0"
coil = "3.0.4"
coroutines = "1.9.0"
navigation = "3.0.0-alpha10"
junit5 = "5.10.3"
mockk = "1.13.13"
turbine = "1.2.0"

[libraries]
# Compose (managed by BOM)
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" }

# Lifecycle
lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }

# Navigation
navigation-compose = { group = "androidx.navigation3", name = "navigation-compose", version.ref = "navigation" }

# Hilt
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version = "1.2.0" }

# Room
room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }

# Networking
retrofit = { group = "com.squareup.retrofit2", name = "retrofit", version.ref = "retrofit" }
retrofit-kotlinx-serialization = { group = "com.squareup.retrofit2", name = "converter-kotlinx-serialization", version.ref = "retrofit" }
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
okhttp-logging = { group = "com.squareup.okhttp3", name = "logging-interceptor", version.ref = "okhttp" }

# Image loading
coil-compose = { group = "io.coil-kt.coil3", name = "coil-compose", version.ref = "coil" }
coil-network-okhttp = { group = "io.coil-kt.coil3", name = "coil-network-okhttp", version.ref = "coil" }

# Serialization
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version = "1.7.3" }

# Coroutines
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutines" }

# Testing
junit5 = { group = "org.junit.jupiter", name = "junit-jupiter", version.ref = "junit5" }
mockk = { group = "io.mockk", name = "mockk", version.ref = "mockk" }
turbine = { group = "app.cash.turbine", name = "turbine", version.ref = "turbine" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
android-library = { id = "com.android.library", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
compose-compiler = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

## Module Build File (`app/build.gradle.kts`)

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.example.myapp"
    compileSdk = 35  // Use latest stable

    defaultConfig {
        applicationId = "com.example.myapp"
        minSdk = 26
        targetSdk = 35  // Match compileSdk for new projects
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // Compose BOM — manages all Compose library versions
    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)

    // Lifecycle
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)

    // Navigation
    implementation(libs.navigation.compose)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)

    // Image loading
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // Debug tools
    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    // Testing
    testImplementation(libs.junit5)
    testImplementation(libs.mockk)
    testImplementation(libs.turbine)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.compose.ui.test.junit4)
}
```

## KSP vs kapt

KSP (Kotlin Symbol Processing) is faster and more Kotlin-native than kapt. Migrate when possible:

| Processor | KSP Support | Migration |
|---|---|---|
| Hilt | Yes (2.48+) | Change `kapt(libs.hilt.compiler)` → `ksp(libs.hilt.compiler)` |
| Room | Yes (2.6+) | Change `kapt(libs.room.compiler)` → `ksp(libs.room.compiler)` |
| Moshi | Yes | Use `moshi-kotlin-codegen` with KSP |
| Glide | Yes (KSP module) | Use `ksp(libs.glide.ksp)` |

After migrating all processors, remove the kapt plugin:
```kotlin
// Remove this line:
// id("org.jetbrains.kotlin.kapt")
```

## Build Types and Product Flavors

### Build Types

```kotlin
buildTypes {
    debug {
        applicationIdSuffix = ".debug"  // Install debug alongside release
        isDebuggable = true
        // Don't minify in debug — faster builds
    }
    release {
        isMinifyEnabled = true       // R8 code shrinking
        isShrinkResources = true     // Remove unused resources
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )
        signingConfig = signingConfigs.getByName("release")
    }
}
```

### Product Flavors (When You Need Them)

```kotlin
flavorDimensions += "version"
productFlavors {
    create("free") {
        dimension = "version"
        applicationIdSuffix = ".free"
        buildConfigField("Boolean", "IS_PREMIUM", "false")
    }
    create("paid") {
        dimension = "version"
        applicationIdSuffix = ".paid"
        buildConfigField("Boolean", "IS_PREMIUM", "true")
    }
}
```

Use flavors for: free/paid variants, staging/production API endpoints, white-label apps.

Don't use flavors for simple feature flags — use `BuildConfig` fields or remote config instead.

## Useful Gradle Commands

```bash
# Build debug APK
./gradlew assembleDebug

# Build release AAB (for Play Store)
./gradlew bundleRelease

# Run all unit tests
./gradlew test

# Run instrumented tests (requires device/emulator)
./gradlew connectedAndroidTest

# Check dependency tree
./gradlew :app:dependencies --configuration runtimeClasspath

# Find unused dependencies
./gradlew buildHealth  # Requires dependency-analysis plugin

# Clean build cache
./gradlew clean

# Update Gradle wrapper
./gradlew wrapper --gradle-version=8.11
```

## Performance Settings (`gradle.properties`)

```properties
# JVM settings
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+UseParallelGC

# Build performance
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.configureondemand=true

# Kotlin settings
kotlin.code.style=official

# Android settings
android.useAndroidX=true
android.nonTransitiveRClass=true
```
