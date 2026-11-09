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

## Things only a real phone can show (check these first)
Tests cannot judge movement, sound or touch. Please look at these by eye:
- **Pomodoro break**: the outdoor drawing moves slowly (sun, tree, grass, birds, bee, butterfly, steam); the tip is easy to read; with iPhone "Reduce Motion" on, the drawing stands still.
- **Pomodoro hourglass**: the small hourglass button in the header switches ring ⇄ hourglass (the website follows the same choice). At the start of a session the glass turns over, sand falls, grains drop while the timer runs and stop when you pause.
- **Planner month picture** (Calm paper style, Planner › header): sky colour changes with the month; the tree sways slowly; the animal sits (the dog, turtle and hedgehog walk across, the sleigh glides); petals/snow/dust fall; bees/butterflies cross. Check it does not slow scrolling, and that "Reduce Motion" freezes it.
- **Flashcard flip** (open any card viewer): the card turns like a real card, about half a second, with a light tap on iPhone.
- **Flashcard game**: play a game of at least 12 cards. Check that (1) the flame pill jumps on each right answer and shakes when the streak breaks, (2) the toasts (streak steps, level up/down, final stretch) show one at a time and never cover the buttons, (3) the bar changes colour and has a moving light in the final stretch, (4) a checkpoint sheet opens after 10 cards with the number counting up and confetti when you scored 80% or more, (5) the boss round shows your missed cards and ends with "Boss defeated!" when you get all of them, (6) the red discs on the road open the list of mistakes, (7) sounds follow the silent switch and can be turned off with the gear, and (8) the vibrations feel right (light on right, double on wrong, strong on boss win).
