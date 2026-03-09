# Modern Android Platform Features

## Credential Manager (Passkeys & Sign-In)

The unified API for authentication — replaces SmartLock, legacy password managers, and individual sign-in button SDKs.

### What It Handles

- **Passkeys** — biometric/screen-lock authentication, no password needed
- **Saved passwords** — from the user's password manager
- **Federated sign-in** — Google Sign-In, etc.

### Setup

Add dependency:

```toml
[libraries]
credentials = { group = "androidx.credentials", name = "credentials", version = "1.5.0" }
credentials-play-services = { group = "androidx.credentials", name = "credentials-play-services-auth", version = "1.5.0" }
```

### Basic Sign-In Flow

```kotlin
class AuthRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val credentialManager = CredentialManager.create(context)

    // Activity is required — CredentialManager shows a bottom sheet UI
    suspend fun signIn(activity: Activity): SignInResult {
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(
                GetPasswordOption()  // Saved passwords
            )
            // For passkey support, add:
            // .addCredentialOption(GetPublicKeyCredentialOption(requestJson = yourServerWebAuthnJson))
            // Passkeys require server-side WebAuthn configuration.
            // See: https://developer.android.com/identity/sign-in/credential-manager
            .build()

        return try {
            val response = credentialManager.getCredential(activity, request)
            handleSignInResponse(response)
        } catch (e: GetCredentialException) {
            SignInResult.Error(e.message ?: "Sign-in failed")
        }
    }
}

// In Compose, get the Activity from LocalContext:
// val activity = LocalContext.current as? ComponentActivity ?: return
// Then pass it: authRepository.signIn(activity)
```

> **Security note**: For production authentication, consult a security professional. This shows the API pattern, not a complete auth implementation.

## Predictive Back

### What It Is

The system back gesture now shows a preview of where you'll go — the previous screen, the home screen, or the previous app. This replaces the old "override `onBackPressed()`" pattern.

### Why It Matters

**Apps that override `onBackPressed()` will break on API 35+** because the system needs to know what happens *before* the gesture completes to show the preview.

### Migration

**Old (broken on API 35+)**:

```kotlin
// DON'T DO THIS
override fun onBackPressed() {
    if (hasUnsavedChanges) {
        showSaveDialog()
    } else {
        super.onBackPressed()
    }
}
```

**New (works with Predictive Back)**:

```kotlin
// In your Activity or Fragment
val callback = object : OnBackPressedCallback(enabled = true) {
    override fun handleOnBackPressed() {
        if (hasUnsavedChanges) {
            showSaveDialog()
        } else {
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
        }
    }
}
onBackPressedDispatcher.addCallback(this, callback)
```

**In Compose** — Navigation Compose handles Predictive Back automatically. Just use the standard navigation patterns.

### Opting In (For Testing)

Add to `AndroidManifest.xml` to test before it becomes mandatory:

```xml
<application
    android:enableOnBackInvokedCallback="true"
    ...>
```

## Per-App Language Preferences (API 33+)

### What It Is

Users can set different languages per app in system Settings. Your app needs to declare supported locales.

### Setup

Create `res/xml/locales_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<locale-config xmlns:android="http://schemas.android.com/apk/res/android">
    <locale android:name="en"/>
    <locale android:name="es"/>
    <locale android:name="fr"/>
    <locale android:name="de"/>
</locale-config>
```

Reference in `AndroidManifest.xml`:

```xml
<application
    android:localeConfig="@xml/locales_config"
    ...>
```

### Programmatic Language Change

```kotlin
// Get current app locale
val currentLocale = AppCompatDelegate.getApplicationLocales()

// Set app locale programmatically
val localeList = LocaleListCompat.forLanguageTags("es")
AppCompatDelegate.setApplicationLocales(localeList)
```

On API 33+, this delegates to the system per-app language setting.

## Baseline Profiles

### What They Do

Baseline Profiles tell the Android runtime (ART) which code paths to compile ahead of time. Result: **15-50% faster cold start** and smoother interactions from the first launch.

### How to Add

1. Add the Baseline Profile Gradle plugin:

```toml
[plugins]
baseline-profile = { id = "androidx.baselineprofile", version = "1.3.3" }
```

2. Create a `baselineprofile` module (Android Studio template available)

3. Write profile rules (which screens/flows to optimize):

```kotlin
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {

    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generateBaselineProfile() {
        rule.collect(packageName = "com.example.myapp") {
            // Navigate through critical user journeys
            pressHome()
            startActivityAndWait()

            // Scroll the main list
            device.findObject(By.scrollable(true))?.scroll(Direction.DOWN, 1f)

            // Navigate to detail
            device.findObject(By.text("First Item"))?.click()
            device.waitForIdle()
        }
    }
}
```

4. Generated profile is automatically included in release builds.

### When to Add

- **Do add** for any app you publish to Play Store — it's essentially free performance
- **Add after** your app's main flows are stable — profiles need to be regenerated when flows change
- **Don't add** during early development when screens change frequently

## Adaptive Layouts (Android 16+)

### The Change

Android 16 removes the ability to restrict screen orientation on large screens. Apps that force portrait mode will be displayed in their natural orientation on tablets, foldables, and desktop mode.

### What to Do

1. **Support all orientations** — use `WindowSizeClass` to adapt layout:

```kotlin
@Composable
fun TaskApp() {
    val windowSizeClass = calculateWindowSizeClass(LocalContext.current as Activity)

    when (windowSizeClass.widthSizeClass) {
        WindowWidthSizeClass.Compact -> {
            // Phone layout: single column, bottom nav
            PhoneLayout()
        }
        WindowWidthSizeClass.Medium -> {
            // Tablet portrait or foldable: navigation rail
            MediumLayout()
        }
        WindowWidthSizeClass.Expanded -> {
            // Tablet landscape or desktop: navigation drawer + two-pane
            ExpandedLayout()
        }
    }
}
```

2. **Use `NavigationSuiteScaffold`** for adaptive navigation that automatically switches between bottom bar, rail, and drawer based on screen size.

3. **Test on different form factors** — Android Studio has resizable emulators for phone, tablet, foldable, and desktop.

## Foreground Service Types (API 34+)

Starting with API 34, foreground services must declare their type in the manifest:

```xml
<service
    android:name=".LocationTrackingService"
    android:foregroundServiceType="location"
    android:exported="false" />
```

Available types: `camera`, `connectedDevice`, `dataSync`, `health`, `location`, `mediaPlayback`, `mediaProjection`, `microphone`, `phoneCall`, `remoteMessaging`, `shortService`, `specialUse`.

Each type has specific permission requirements. Not declaring the correct type will cause a `MissingForegroundServiceTypeException`.
