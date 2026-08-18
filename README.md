# imaGine

imaGine is a browser based air notes and drawing tool by Danish Puri. It helps people turn hand movement, sketches, and written thoughts into a clear digital note that can be saved as a PNG image or a PDF document.

## Why imaGine exists

Ideas are often easier to explain by drawing than by typing. A presenter should be able to stay focused on the idea instead of reaching for a pen, paper, or a control panel.

imaGine puts the canvas in the browser. A person can draw with a webcam tracked fingertip or use the regular mouse and touch controls. A text area is available for longer notes, so a single export can include both the drawing and the written explanation.

## Who it helps

1. Teachers preparing visual notes
2. Presenters explaining an idea to a group
3. Students capturing sketches and study notes
4. Teams turning a quick discussion into a shareable record
5. Anyone who wants to create without a physical pen or paper

## What is included

1. A digital canvas for freehand drawing
2. Pen, highlighter, and eraser tools
3. Undo, redo, and clear controls
4. A text note area for typed context
5. Webcam tracked fingertip input through Air Draw
6. Mouse and touch input when the camera is not suitable
7. PNG export for a clean image of the canvas
8. PDF export with the title, date, drawing, and text note

## Use the app

1. Open `index.html` in a browser
2. Give the note a title
3. Select the pen, highlighter, or eraser
4. Draw on the canvas or enter supporting text
5. Choose Air Draw if you want to use a webcam tracked fingertip
6. Select PNG or PDF to save the note

Air Draw uses three simple gestures:

1. Extend the index finger to move the on screen cursor
2. Pinch the index finger and thumb, or hold the gesture, to draw
3. Release the pinch to lift the virtual pen

## Run locally

The app is a static web page. Start any local web server from the project folder and open:

    http://localhost:8000/

The page loads the hand tracking and PDF libraries from public content delivery services. An internet connection is needed when those libraries are not already available in the browser cache.

Camera access usually requires a secure browser context. Localhost is supported by modern browsers. If camera access is unavailable, drawing, typing, export, undo, redo, and clear still work with local input.

## Privacy

Camera frames are processed in the browser and are not uploaded by imaGine. The note stays in the current browser session unless you choose to export it. Review browser camera permissions before presenting, especially on a shared computer.

## Export details

PNG export saves the current drawing canvas as an image.

PDF export creates an A4 document with the note title, the creation date, the drawing, and any text entered in the note area. The export uses the browser session content at the moment you select the PDF control.

## Public files

The public repository contains only the files needed to run and understand the app:

1. `index.html` contains the interface and library references
2. `style.css` contains the visual design
3. `app.js` contains drawing, tracking, history, and export behavior
4. `README.md` contains product and usage documentation

## Product status

imaGine is an early working MVP. The core drawing, text note, export, and fallback input flows are available. Hand tracking is an experimental input layer and should be tested on the target computer before a live session.

## Author

Danish Puri 
