# KeySpeaker WEB DEMO

[日本語版](README_JA.md) · The page itself is in English, with a Japanese switch at the top right.

A browser demo of the Cardputer ADV KeySpeaker, drawn pixel for pixel on a 240 x 135 canvas in a Cardputer-style body,
following the firmware's behavior as closely as a browser allows. Static HTML / CSS / JavaScript only: open `index.html`
or serve the folder (GitHub Pages works). It can be added to a phone's home screen (PWA).

Screens, ported from the firmware (`KeySpeaker_S0.ino`, `FlightViz.h`, `KeyEarth.h`, `Splash.h`):

- **Start screen** and the **resting emblem** use the firmware's own images. At rest (measure mode, one minute with no
  key and no sound) the emblem comes back with the `h HELP  Fn+M KEYBOARD` line, shakes on loud beats, and a key only wakes it.
- **Measure mode**: the measurement screen. Buffer, counters and PC volume are demo values; the levels follow the sound.
- **Flight mode**: the sound's level builds the terrain, a fighter flies over it, shoots targets and bombs craters; the
  30-band equalizer comes and goes by itself (every minute or after a gap between songs).
  While music plays, a space monster (the beast from the Space Invaders cabinet art) now and then walks in behind the
  terrain and reaches for the fighter with a clawed hand, drawn in front of everything, and misses.
- **Keyboard (text input) mode**: the spinning Earth with "KEY BOARD", Mac/Win and A/あ, the cheat sheet, and the
  MOUSE screen while G0 is held.
- **Help screen**, with the device's own key list.

`Fn+M` cycles measure -> flight -> keyboard; the last mode is remembered (flight at first).

## Audio source

There are two live sources, plus a test sound. Only one runs at a time: choosing one stops the others.

- **START** (computers): the sound this computer is playing, through the browser's screen / tab sharing (`getDisplayMedia`).
  Pick the tab (or screen) that makes the sound and tick **Share audio**. Chrome / Edge on Windows can share the whole
  system's sound with "Entire screen"; on Mac and Linux share a tab. The video is discarded. Safari and Firefox cannot
  share audio; play the music in a different tab of the same browser.
- **MIC START** (phones, and a choice on computers): the microphone (`getUserMedia`). The browser is asked for permission
  only when the button is pressed, and the page must be opened over HTTPS (or `localhost`). Phone browsers cannot capture
  the sound the phone itself plays, so on a phone START is hidden and MIC START is the main button. If permission is
  refused, allow the microphone in the browser's site settings and press the button again.
- **Test sound** plays a synthetic song into the screen without sharing or listening to anything.

In every case the audio is only analysed in the browser to drive the screen: it is never played through the speakers,
recorded or uploaded. The line under the buttons shows what the page receives. START, MIC START and full screen are
buttons only: the device has no such keys.

## Keys (the device's own; `Fn` is `Shift` on a computer)

| Key | Meaning |
|---|---|
| `[` `]` / `\` | volume / mute (display only here) |
| `space`, `,` `/` | play-pause, previous, next (no effect here) |
| `-` `=` / `b` | boost / bass cut (display only) |
| `r` | reset counts |
| `v` | measure / flight |
| `h`, or any key with no job | help screen |
| `Fn+M` | next mode |
| `Fn+O` | Mac / Win |
| `Fn+A` | AUX on / off (display only) |
| `Fn+[` `Fn+]` | input A / あ (keyboard mode) |
| G0 button (hold) | MOUSE screen (keyboard mode) |

Notes: BLE is never shown (the screen always says USB), and key presses on a real Cardputer connected to the computer are not picked up by the page; only the computer's own keyboard and the on-screen buttons work.

Not reproduced: sending keys, the mouse and media keys to a computer, USB / BLE, the Grove AUX input, the speaker.

MIT License, see `LICENSE`. The emblem is KariPom's and comes from the firmware project.
