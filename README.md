# The Calculator

A Matrix-inspired calculator and mini game built with plain HTML, CSS, and JavaScript.

This started as a Foundations-era calculator project from The Odin Project and has been reshaped into a terminal-style experience: enter your first name, watch the Matrix sequence unfold, then type calculations like sentences. Pressing `=` evaluates the equation before it.

## Features

- Matrix-style falling character background
- First-name intro with persistent local storage
- Terminal boot messages and typewriter answer responses
- Sentence-friendly calculation input
- Automatic spacing around math operators
- Scrollable calculation history
- Hidden red-pill and blue-pill easter egg buttons
- Red-pill side-scroller mini game with Neo, agents, obstacles, bullet dodges, stunt jumps, and a phone booth ending
- Looping game music from `assets/neon-rainfall.mp3`

## Running Locally

Open `index.html` directly in a browser, or run a local static server from this folder:

```sh
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000/
```

Using a local server is recommended so the MP3 and browser behavior match the hosted version more closely.

## Calculator Usage

Type an equation into the terminal prompt and press `=`.

Examples:

```text
12 / (2 + 4)=
what is 18 * 7=
100 - 42=
```

The app extracts the math expression from the sentence, evaluates it, and types the answer back into the terminal.

## Game Controls

The red-pill game is hidden in the bottom-left corner of the screen. Hover to reveal it.

Controls:

- `ArrowLeft` / `ArrowRight`: move Neo
- `Space`: trigger a stunt near obstacles
- `S`: shoot
- `A`: punch
- `D`: kick

The blue pill is hidden in the bottom-right corner. Hover to reveal it. It clears the saved first name and reruns the intro sequence.

## Project Files

- `index.html`: page structure, terminal, game canvas, audio element
- `style.css`: Matrix visuals, terminal layout, hidden pills, game styling
- `script.js`: calculator parser, Matrix rain, intro flow, easter eggs, and game logic
- `assets/neon-rainfall.mp3`: game music

## Notes

The app stores the user's first name in `localStorage` so returning visitors can skip the name prompt. The blue pill clears that saved name and restarts the Matrix intro.
