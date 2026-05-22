# 🦕 Dino Catcher — Fiero Edition

A dinosaur clicking game built for young coders! Dinosaurs pop up on the screen — click them before they escape to add them to your park. This version was made to be opened, read, and changed in **Fiero code**.

---

## How to open it in Fiero

1. In Fiero, click **"HTML, CSS, JS"** to create a new project
2. Open the file `index.html` from this folder
3. Copy all of the text inside it
4. Paste it into Fiero's editor
5. Click **Run** — your game should appear!

---

## How the file is organised

Everything lives in one file: `index.html`. It has five clearly labelled sections — look for the big comment banners to find them:

| Section | What it does | Where to look |
|---|---|---|
| **Section 1 — HTML** | The layout of the page (header, arena, park panel) | Near the top, after `<body>` |
| **Section 2 — CSS** | All the colours, sizes, and animations | Inside the `<style>` tag |
| **Section 3 — Dinosaur List** | The list of all dinos in the game | `const DINOSAURS = [` |
| **Section 4 — Game Settings** | Numbers that control how the game feels | `const GAME_TIME`, `DINO_SPEED`, etc. |
| **Section 5 — Game Logic** | The functions that make everything work | Inside the `<script>` tag |

---

## Your first three challenges

These are great things to try on your very first coding session!

### Challenge 1 — Change the game time ⏱️

Find this line in **Section 4**:
```js
const GAME_TIME = 60;
```
Change `60` to `30` for a super fast game, or `120` for a longer one. Then run it again!

---

### Challenge 2 — Change a colour 🎨

Find this section at the top of the `<style>` tag:
```css
:root {
  --background: #1a1a2e;   /* The dark blue background */
  --button-color: #e94560; /* The start button */
}
```
Try changing `#1a1a2e` to `#006400` to make the background dark green — like a jungle!

> **Tip:** Colours in CSS are written as `#` followed by 6 letters and numbers. You can find colours to try at any colour picker website.

---

### Challenge 3 — Add a new dinosaur 🦕

Find the `DINOSAURS` list in **Section 3** and add a new line inside it:
```js
{ name: "Diplodocus", emoji: "🦕", points: 6, rarity: "common", color: "#20c997" },
```
Make sure to put it before the last `];` line. Change the name, emoji, and color to whatever you like!

---

## Want to do more?

Check out **`IDEAS.md`** in this same folder — it has loads of ideas for new features, from easy tweaks all the way up to building a park manager!
