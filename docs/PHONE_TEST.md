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

## Voice and dictation (needs the development build — they do not work in Expo Go)
These use the phone's own speech recognition (Apple on iPhone, Google on Android). Tests cannot judge how well it hears you, so please check by ear:
- **Permissions**: the first time, iPhone asks for the microphone *and* speech recognition; Android asks for the microphone. If you say no, the voice bar must explain it and stay off (no crash).
- **Diary dictation** (Diary › a day › the mic next to the text): your words appear as you speak, with capital letters and full stops where you pause; saying "comma", "new line" etc. works as on the website; stopping the mic keeps the text.
- **To buy dictation** (To buy › mic): one sentence = one item, the mic stops by itself after the sentence.
- **Flashcard voice game** (Game › mic button in the header › "Got it, start"): check that (1) the question is read aloud, (2) saying "answer" shows and reads the answer, (3) saying "correct" / "wrong" grades and the next question starts, (4) the voice reading the card is NOT taken as your command (try a card that contains the word "right"), (5) at the checkpoint it reads the summary and "boss" / "continue" work, (6) in the boss round "answer", "I got it" / "wrong" work, (7) in a vocabulary game, saying the word shows it, reads it and marks it correct after about 3 seconds; saying "wrong" in that time marks it wrong instead, (8) "repeat" reads again from the start, (9) it still works with headphones, with the silent switch on (reading uses the media volume) and after a phone call interrupts, (10) the command language (Italian / English US / English UK) and the "what it reads" choices in the intro sheet are remembered.
- **If the microphone keeps stopping** on iPhone: tell me how long it listens before it stops; the app reopens it by itself, but iOS may make it wait a few seconds.
- **Privacy label (App Store)**: because speech is processed by Apple/Google, the "Audio data" and "Other user content" answers must say it is used for app functionality only, not for tracking.

## AI reports/books and picture pairing (need internet)
- **Diary › Insights › Reports and book**: each quarter shows how many days/words you wrote. With enough (15 days, 1500 words) the buttons appear. Check that (1) "Create the report" first shows the estimated cost and the privacy sentence, (2) Create writes the report in about half a minute and opens it, (3) "Create the book" shows its progress chapter by chapter, (4) if you switch off the internet in the middle, the book is kept and "Continue writing" finishes it without paying twice, (5) with no credits left the message says so and Create stays off.
- **Insert cards › Generate from images**: choose 3+ pictures for the questions and 3+ for the answers; the pairing screen must open already paired in order; tapping a pair frees it, tapping the other picture links it; "unmatched" pictures become cards with one picture. Check the photos appear on the cards after a moment (they upload in the background).
