# Play Store Publishing Checklist

## Before You Start

- [ ] Google Play Developer account ($25 one-time fee)
- [ ] App is feature-complete and tested on multiple devices/screen sizes
- [ ] All third-party library licenses are respected
- [ ] Privacy policy URL (required if you collect any user data)

## Step 1: Prepare the Release Build

### App Signing

Google Play App Signing is recommended — Google manages the app signing key, you manage an upload key. This means if you lose your upload key, you can reset it without losing your app.

**Generate upload key** (first time only):

```bash
keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

**IMPORTANT**: Back up `upload-keystore.jks` securely. Never commit it to source control.

### Configure Signing in Gradle

Create `keystore.properties` (add to `.gitignore`):

```properties
storeFile=../upload-keystore.jks
storePassword=your_store_password
keyAlias=upload
keyPassword=your_key_password
```

In `app/build.gradle.kts`:

```kotlin
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) {
        load(file.inputStream())
    }
}

android {
    signingConfigs {
        create("release") {
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### Build the AAB

```bash
./gradlew bundleRelease
```

Output: `app/build/outputs/bundle/release/app-release.aab`

**Always use AAB (Android App Bundle), not APK.** Google Play generates optimized APKs for each device configuration, resulting in smaller downloads.

### Test the Release Build

Before uploading, install the release build on a physical device to verify:
- App launches correctly
- No crashes from R8/ProGuard stripping
- All features work (especially anything using reflection: serialization, Hilt, Retrofit)

```bash
# Install release build directly (for testing)
./gradlew installRelease
```

## Step 2: Store Listing

### Required Assets

| Asset | Requirements |
|---|---|
| **App icon** | 512 × 512 px, PNG, 32-bit with alpha |
| **Feature graphic** | 1024 × 500 px, PNG or JPEG |
| **Phone screenshots** | 2-8 screenshots, 16:9 or 9:16, min 320px, max 3840px |
| **Tablet screenshots** | Required if you support tablets (7" and 10") |
| **Short description** | Max 80 characters |
| **Full description** | Max 4000 characters |

### Tips for Screenshots

- Show real app screens with realistic data
- Add captions highlighting key features
- First two screenshots should show your best features (they appear in search results)
- Use Android Studio's built-in screenshot tool or the emulator's screenshot button

### App Details

- **Title**: Max 30 characters. Make it clear what the app does.
- **Category**: Choose the most specific category that fits
- **Content rating**: Complete the IARC questionnaire honestly
- **Contact information**: Email required; phone and website optional

## Step 3: Data Safety Section

Google Play requires you to declare what data your app collects, shares, and how it's secured.

### Common Declarations

| If Your App... | Declare |
|---|---|
| Uses analytics (Firebase, etc.) | Device identifiers, app interactions |
| Has user accounts | Email, name, auth tokens |
| Uses crash reporting | Crash logs, device info |
| Stores data on device only | "No data collected" (if truly nothing leaves the device) |
| Uses location | Location data, purpose of collection |

Be thorough and honest — Google reviews these declarations and can remove apps for inaccuracy.

## Step 4: Testing Tracks

Google Play has four release tracks:

1. **Internal testing** — up to 100 testers, instant publishing (no review)
2. **Closed testing** — invite-only, up to 100,000 testers by email or Google Group
3. **Open testing** — anyone can join via a link, limited slots
4. **Production** — available to everyone on the Play Store

### Recommended Path

1. Start with **internal testing** — upload your first AAB here
2. Install on multiple devices, test all flows
3. Promote to **closed testing** if you want beta feedback
4. Promote to **production** when ready

### First Upload

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in app details, content rating, data safety
4. Go to **Testing → Internal testing → Create new release**
5. Upload your AAB
6. Add release notes
7. Review and roll out

## Step 5: Production Release

### Pre-Launch Checklist

- [ ] Tested on internal/closed testing track
- [ ] Tested on minimum API level device
- [ ] Tested on phone and tablet (if supporting both)
- [ ] All store listing assets uploaded
- [ ] Privacy policy URL provided
- [ ] Data safety section completed
- [ ] Content rating questionnaire completed
- [ ] App meets [Play Store policies](https://play.google.com/about/developer-content-policy/)

### Rolling Out

1. Go to **Production → Create new release**
2. Upload the same AAB from testing (or upload a new one)
3. Write release notes for users
4. Choose rollout percentage:
   - **Staged rollout** (recommended): Start at 5-10%, monitor crashes, then increase
   - **Full rollout**: 100% immediately
5. Review and roll out

### After Launch

- **Monitor crash rate**: Android Vitals in Play Console shows crash-free users percentage. Target: >99%
- **Monitor ANR rate**: Application Not Responding. Target: <0.47%
- **Respond to reviews**: Users appreciate engagement
- **Plan updates**: Regular updates improve store ranking

## Step 6: Updates

### Version Bumping

In `app/build.gradle.kts`:

```kotlin
defaultConfig {
    versionCode = 2          // Increment for every upload (integer, must increase)
    versionName = "1.1.0"    // User-visible version string
}
```

- `versionCode` must always increase — the Play Store rejects uploads with the same or lower code
- `versionName` follows [Semantic Versioning](https://semver.org/) by convention

### Update Process

1. Increment `versionCode` and update `versionName`
2. Build release AAB: `./gradlew bundleRelease`
3. Upload to internal testing → verify → promote to production
4. Write release notes describing what changed

## Common Publishing Mistakes

| Mistake | Consequence | Prevention |
|---|---|---|
| Forgot to increment `versionCode` | Upload rejected | Automate with CI or check before building |
| Committed signing key to Git | Security breach | Add `*.jks` and `keystore.properties` to `.gitignore` from the start |
| Hardcoded API keys | Key exposed in AAB | Use `local.properties` + `BuildConfig` injection |
| No ProGuard rules for reflection | Release build crashes | Test release build on device before uploading |
| Missing privacy policy | App rejected or removed | Add privacy policy URL even for simple apps |
| Targeting old SDK | App rejected after deadline | Check Play Console for current target SDK requirement |
