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

## iPad instead of iPhone
The app is declared **iPhone-only** (`supportsTablet: false`). On an iPad, iOS then runs it in "iPhone compatibility
mode": a phone-sized window in the middle of the screen. It is good for checking layout and features, but it is not
identical to a real iPhone (no notch or Dynamic Island, different keyboard and speed). Before a store release,
always test on a real iPhone too (TestFlight works for that).
