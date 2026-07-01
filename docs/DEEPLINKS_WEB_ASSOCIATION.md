# Deep Link Web Association

Explore serves web-domain association files and lightweight fallback pages for shared mobile links on:

```text
https://www.exploreapphq.com
```

## Association Files

iOS Universal Links:

```text
https://www.exploreapphq.com/.well-known/apple-app-site-association
```

Android App Links:

```text
https://www.exploreapphq.com/.well-known/assetlinks.json
```

Both files live in `public/.well-known/` and are configured in `vercel.json` with `Content-Type: application/json; charset=utf-8`.

## Supported Paths

Primary shared-link paths:

```text
/v/*
/p/*
/r/*
/u/*
/me
```

Legacy aliases are also included:

```text
/video/*
/place/*
/route/*
/profile/*
/users/*
```

## Values To Replace

`public/.well-known/apple-app-site-association` currently contains placeholders:

```text
REPLACE_WITH_APPLE_TEAM_ID
REPLACE_WITH_IOS_BUNDLE_ID
```

`public/.well-known/assetlinks.json` uses the Android package name from the current Google Play URL:

```text
com.explore.miapp
```

It still needs the Play App Signing SHA-256 fingerprint:

```text
REPLACE_WITH_GOOGLE_PLAY_APP_SIGNING_SHA256_FINGERPRINT
```

## Apple Values

Apple Team ID:

1. Open Apple Developer.
2. Go to Membership details.
3. Copy the Team ID.

iOS bundle ID:

1. Open Apple Developer Certificates, Identifiers & Profiles.
2. Open Identifiers.
3. Select the Explore app identifier.
4. Copy the Bundle ID, for example `com.company.explore`.

The final Apple app ID format is:

```text
TEAM_ID.BUNDLE_ID
```

## Android Values

Android package name:

1. Open Google Play Console.
2. Select the Explore app.
3. Confirm the package name under app details or the Play Store URL.

Google Play App Signing SHA-256:

1. Open Google Play Console.
2. Select the Explore app.
3. Go to Setup, then App integrity.
4. Open App signing.
5. Copy the SHA-256 certificate fingerprint from the App signing key certificate section.

Use the Play App Signing fingerprint, not only a local upload/debug keystore fingerprint.

## Local Fallback Routes

The web app renders safe generic fallback pages for:

```text
/v/:videoId
/p/:placeId
/r/:routeId
/u/:handleOrUserId
/me
```

Legacy aliases render the same fallback style:

```text
/video/:videoId
/place/:placeId
/route/:routeId
/profile/:handleOrUserId
/users/:handleOrUserId
```

These pages do not fake content details. They show the content type, URL ID or handle, an "Open in Explore" button, and App Store / Google Play links.

The "Open in Explore" button currently uses the custom URL scheme `explore://`. Update `src/pages/marketing/DeepLinkFallbackPage.tsx` if the production native app uses a different scheme.

## Testing iOS Universal Links

1. Replace the Apple placeholders with the production Team ID and bundle ID.
2. Deploy to `https://www.exploreapphq.com`.
3. Verify `/.well-known/apple-app-site-association` returns HTTP 200, valid JSON, and no redirect.
4. Add the Associated Domains entitlement to the iOS app:

```text
applinks:www.exploreapphq.com
```

5. Install a TestFlight or production build on a real device.
6. Open a link such as `https://www.exploreapphq.com/v/test-id` from Notes, Messages, Mail, or Safari.

Expo Go is not enough for final Universal Link testing because it does not use the final app bundle identifier and entitlements.

## Testing Android App Links

1. Replace the SHA-256 placeholder with the Google Play App Signing fingerprint.
2. Deploy to `https://www.exploreapphq.com`.
3. Verify `/.well-known/assetlinks.json` returns HTTP 200, valid JSON, and no redirect.
4. Add matching Android intent filters for the domain and paths.
5. Install an internal, closed, open, or production Play build.
6. Test with:

```bash
adb shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "https://www.exploreapphq.com/v/test-id"
```

Expo Go is not enough for final Android App Link testing because the final package name, signing key, and intent filters must match the production app.
