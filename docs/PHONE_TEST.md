# Testing the app on a real phone (development build)

Expo Go **cannot** run this app: the database is encrypted with SQLCipher, which needs a native build.
So we make a "development build" once, install it, and then it updates over Wi-Fi while we work.

## Android (free)
1. Make a free account at https://expo.dev and note your username.
2. On your computer (Node 20+ installed): `npm install -g eas-cli`, then `eas login`.
3. In the app folder: `eas init` (links the project to your account), then
   `eas build --profile development --platform android`.
4. When the build finishes, open the link it prints **on the phone** and install the APK
   (Android asks to allow installs from the browser: accept).
5. For the live test against the real site no server is needed: the app talks to https://nisama.altervista.org.

## iPhone
Installing on a real iPhone needs the Apple Developer account (99 USD/year). Until you decide that,
test on Android; the same code runs on iOS.

## Security note
The development build is signed with a debug key and is only for you. Never share the APK.

## iPad: phone-sized window or full tablet
The shipping app supports iPhone **and** iPad (`supportsTablet: true`).
To check the **phone layout on an iPad**, build with the profile `development-phone`
(`eas build --profile development-phone --platform ios`): it sets `STANDOUT_PHONE_ONLY=1`, the app then declares
itself iPhone-only and iPadOS shows it in a phone-sized window (iPhone compatibility mode).
To check the real iPad layout, build with the normal `development` profile.
The phone-sized window is not identical to a real iPhone (no notch or Dynamic Island, different keyboard and
speed), so before a store release always test on a real iPhone too (TestFlight works for that).

## Other people's devices
Every device (your iPad, your girlfriend's iPhone) must be registered once with `eas device:create`, and needs
Developer Mode on. If you log in on her phone with your account, your tasks are stored on her phone until you log out:
log out when you finish.
