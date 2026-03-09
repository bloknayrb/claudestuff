# Runtime Permissions Guide

## The Modern Approach

Android's permission model has evolved significantly. Many things that used to require permissions now have dedicated APIs that don't need them. Always check if a permission-free alternative exists before requesting.

## Permission-Free Alternatives

| You Want To... | Don't Request | Instead Use |
|---|---|---|
| Let user pick a photo/video | `READ_EXTERNAL_STORAGE` | Photo Picker (`PickVisualMedia`) |
| Take a photo and save it | `CAMERA` + `WRITE_EXTERNAL_STORAGE` | `TakePicture` contract (still needs `CAMERA`) |
| Save a file to Downloads | `WRITE_EXTERNAL_STORAGE` | `MediaStore` or SAF (`CreateDocument`) |
| Read your app's own files | Any permission | `context.filesDir` / `context.cacheDir` |
| Open a document | `READ_EXTERNAL_STORAGE` | `OpenDocument` contract (SAF) |
| Get current location once | — | Still needs `ACCESS_COARSE_LOCATION` or `ACCESS_FINE_LOCATION` |
| Schedule an exact alarm | `SCHEDULE_EXACT_ALARM` | `USE_EXACT_ALARM` for clock/timer apps (no runtime request) |

## Photo Picker (No Permission Needed)

The preferred way to let users select photos or videos:

```kotlin
// In your Activity or Composable
val pickMedia = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.PickVisualMedia()
) { uri ->
    if (uri != null) {
        // Use the selected media URI
        // URI is temporary — copy to app storage if needed long-term
    }
}

// Launch the picker
Button(onClick = {
    pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
}) {
    Text("Select Photo")
}
```

For multiple selection:

```kotlin
val pickMultipleMedia = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = 5)
) { uris ->
    // Handle selected URIs
}
```

## Requesting Runtime Permissions

### Single Permission

```kotlin
@Composable
fun CameraScreen() {
    val context = LocalContext.current

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // Permission granted — proceed with camera
        } else {
            // Permission denied — show explanation or degrade gracefully
        }
    }

    val hasCameraPermission = ContextCompat.checkSelfPermission(
        context, Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED

    if (hasCameraPermission) {
        CameraPreview()
    } else {
        PermissionRequest(
            title = "Camera Access",
            message = "This app needs camera access to scan barcodes.",
            onRequestPermission = {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        )
    }
}

@Composable
private fun PermissionRequest(
    title: String,
    message: String,
    onRequestPermission: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = title, style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRequestPermission) {
            Text("Grant Permission")
        }
    }
}
```

### Multiple Permissions

```kotlin
val locationPermissions = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestMultiplePermissions()
) { permissions ->
    val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
    val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

    when {
        fineGranted -> { /* Precise location available */ }
        coarseGranted -> { /* Approximate location available */ }
        else -> { /* No location — degrade gracefully */ }
    }
}

// Request both, system will show appropriate dialog
locationPermissions.launch(
    arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )
)
```

## Handling "Don't Ask Again"

After the user selects "Don't ask again," the permission launcher returns denied immediately without showing a dialog. Detect this and guide to Settings:

```kotlin
@Composable
fun PermissionWithSettingsFallback(
    permission: String,
    rationale: String,
    onPermissionGranted: @Composable () -> Unit,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    var hasRequested by rememberSaveable { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasRequested = true
        // State update triggers recomposition
    }

    val isGranted = ContextCompat.checkSelfPermission(
        context, permission
    ) == PackageManager.PERMISSION_GRANTED

    when {
        isGranted -> onPermissionGranted()
        hasRequested -> {
            // Already asked and denied (possibly "Don't ask again")
            Column(
                modifier = Modifier.fillMaxSize().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(rationale, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                }) {
                    Text("Open Settings")
                }
            }
        }
        else -> {
            Column(
                modifier = Modifier.fillMaxSize().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(rationale, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = { permissionLauncher.launch(permission) }) {
                    Text("Grant Permission")
                }
            }
        }
    }
}
```

## Notification Permission (API 33+)

Starting with Android 13, apps need to request `POST_NOTIFICATIONS`:

```kotlin
// Always declare the launcher unconditionally — Compose requires
// remember* calls to run on every recomposition, not inside conditionals.
val notificationPermission = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
) { granted ->
    // Notifications will work regardless — they just won't show if denied
}

// Only request on API 33+
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    LaunchedEffect(Unit) {
        if (ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
```

## Manifest Declaration

All runtime permissions must also be declared in `AndroidManifest.xml`:

```xml
<manifest>
    <!-- Declare permissions your app uses -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Optional: declare features as not required for broader device compatibility -->
    <uses-feature android:name="android.hardware.camera" android:required="false" />
</manifest>
```

## Best Practices

1. **Request in context** — ask when the user triggers the relevant feature, not at app launch
2. **Explain before asking** — show a screen explaining why you need the permission
3. **Degrade gracefully** — always have a fallback if permission is denied
4. **Request minimum scope** — `ACCESS_COARSE_LOCATION` if precise isn't needed
5. **Don't block the app** — permission denial should never prevent using the rest of the app
6. **Test all states** — granted, denied, denied with "Don't ask again", and pre-API 33 for notifications
