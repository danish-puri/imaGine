# imaGine

imaGine is a browser based air notes and drawing tool by Danish Puri. It helps people capture ideas with natural hand movement and export a clear record of the session.

## The opportunity

Presenters often need to move between the screen, a mouse, and a whiteboard while they teach. That movement interrupts attention and makes useful annotations difficult to keep.

imaGine brings drawing and annotation into one calm workspace. A person can use a webcam tracked hand, a mouse, touch, or a keyboard. The result is a more direct way to express an idea and a simple way to save it.

## Who it is for

1. Teachers preparing visual notes
2. Presenters explaining ideas to a group
3. Students and teams that need to capture visual notes
4. Anyone who wants to draw without a physical pen or paper

## Current product

The air notes workspace in `code/index.html` provides:

1. A digital canvas for notes and sketches
2. Pen, highlighter, and eraser tools
3. Undo, redo, and clear controls
4. Webcam tracked fingertip drawing in the air
5. Mouse and touch input as reliable fallbacks
6. PNG and PDF export

The workspace keeps camera processing in the browser and maps hand movement to marks on the canvas.

## How it works

1. Open the air notes workspace in a browser
2. Select a drawing tool
3. Turn on Air Draw when you want to use a webcam tracked fingertip
4. Add notes, sketches, or annotations
5. Export the result as a PNG or PDF

Camera video is processed in the browser. It is not uploaded. If camera access is unavailable, the drawing workflow remains available through mouse and touch input.

## Quick start

From the project folder, start a local web server on port 8000. Any simple static server will work. Then open:

    http://localhost:8000/code/

Useful controls include:

1. Use the Air Draw button to start or stop webcam input
2. Choose the pen, highlighter, or eraser tool
3. Use undo, redo, and clear to manage the canvas
4. Use the PNG or PDF export controls to save your work

Camera access usually requires a secure browser context. Localhost is supported by modern browsers.

## Project layout

1. `code/` contains the air notes workspace
2. `design/` contains product design notes
3. `motivation/` contains the original project motivation

## Product status

imaGine is an early working MVP. The drawing workflow, annotation tools, export paths, and input fallbacks are in place. Gesture recognition remains an experimental input layer while it is tested on real devices.

## Privacy and responsible use

The project is designed around local processing. Presenters should still review browser camera permissions before a session and confirm that the exported lesson contains only material they intend to share.

## Author

Danish Puri is the sole author of imaGine.
