# imaGine

imaGine is a browser based presentation and annotation tool by Danish Puri. It helps teachers and presenters control a lesson, explain ideas with natural hand movement, and export a clear record of the session.

## The opportunity

Presenters often need to move between the screen, a mouse, and a whiteboard while they teach. That movement interrupts attention and makes useful annotations difficult to keep.

imaGine brings presentation control and annotation into one calm workspace. A presenter can use a webcam tracked hand, a mouse, touch, or a keyboard. The result is a more direct way to explain an idea and a simple way to save it.

## Who it is for

1. Teachers leading lessons in a classroom
2. Presenters explaining ideas to a group
3. Students and teams that need to capture visual notes
4. Anyone who wants to draw without a physical pen or paper

## Current product

The classroom studio in `v2/v2/index.html` provides:

1. A sample lesson with three presentation slides
2. Drawing, erasing, undo, and clear controls
3. A laser pointer for directing attention
4. Keyboard controls for slide navigation and tools
5. Mouse and touch input as reliable fallbacks
6. Optional local webcam access for future gesture input
7. PNG export and browser printing for PDF output

The earlier air drawing experience in `code/index.html` explores fingertip tracking and air drawing on a digital canvas.

## How it works

1. Open the lesson studio in a browser
2. Select a tool with the rail or keyboard shortcuts
3. Present the lesson and add annotations as you speak
4. Export the annotated view as a PNG or PDF

Camera video is processed in the browser. It is not uploaded. If camera access is unavailable, the main presentation workflow remains available through mouse, touch, and keyboard input.

## Quick start

From the project folder, start a local web server on port 8000. Any simple static server will work. Then open:

    http://localhost:8000/v2/v2/

Useful controls:

1. Press `D` to draw
2. Press `L` to use the laser pointer
3. Press `E` to erase
4. Press the left or right arrow key to change slides
5. Use the export menu to save a PNG or print to PDF

Camera access usually requires a secure browser context. Localhost is supported by modern browsers.

## Project layout

1. `v2/v2/` contains the classroom presentation studio
2. `code/` contains the original air drawing experience
3. `design/` contains product design notes
4. `motivation/` contains the original project motivation

## Product status

imaGine is an early working MVP. The classroom workflow, annotation tools, export paths, and input fallbacks are in place. Gesture recognition is an experimental input layer and remains modular while it is tested on real devices.

## Privacy and responsible use

The project is designed around local processing. Presenters should still review browser camera permissions before a session and confirm that the exported lesson contains only material they intend to share.

## Author

Danish Puri is the sole author of imaGine.
