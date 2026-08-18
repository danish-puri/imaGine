/**
 * Imagine - Air Notes & Air Drawing Web Application Engine
 * Integrates Apple Notes Aesthetic with MediaPipe AI Computer Vision Hand Tracking
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // --- STATE MANAGEMENT ---
  let notes = [];
  let currentNoteId = null;
  let activeTool = 'pen'; // pen, highlighter, eraser
  let activeColor = '#f5a623';
  let activeSize = 5;

  // Undo / Redo History
  let historyStack = [];
  let historyStep = -1;
  const MAX_HISTORY = 25;

  // Air Drawing State
  let isAirDrawActive = false;
  let handsModel = null;
  let cameraInstance = null;
  let isAirDrawing = false;
  let lastAirPoint = null;
  
  // Exponential Smoothing for Air Cursor
  let smoothX = null;
  let smoothY = null;
  const SMOOTH_FACTOR = 0.35; // Balance responsiveness vs stability

  // --- DOM ELEMENTS ---
  const notesListEl = document.getElementById('notesList');
  const btnNewNote = document.getElementById('btnNewNote');
  const searchInput = document.getElementById('searchInput');
  const noteTitleInput = document.getElementById('noteTitleInput');
  const textEditor = document.getElementById('textEditor');

  const sketchCanvas = document.getElementById('sketchCanvas');
  const ctx = sketchCanvas.getContext('2d');

  const btnAirDrawToggle = document.getElementById('btnAirDrawToggle');
  const airDrawLabel = document.getElementById('airDrawLabel');
  const airPulse = document.getElementById('airPulse');
  const airHud = document.getElementById('airHud');
  const btnHudClose = document.getElementById('btnHudClose');
  const webcamVideo = document.getElementById('webcamVideo');
  const trackingCanvas = document.getElementById('trackingCanvas');
  const trackingCtx = trackingCanvas.getContext('2d');
  const trackingStateEl = document.getElementById('trackingState');
  const airCursor = document.getElementById('airCursor');

  const toolBtns = document.querySelectorAll('.tool-btn');
  const brushColorInput = document.getElementById('brushColor');
  const brushSizeInput = document.getElementById('brushSize');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnClearCanvas = document.getElementById('btnClearCanvas');
  const btnExportPNG = document.getElementById('btnExportPNG');
  const btnExportPDF = document.getElementById('btnExportPDF');

  const countAll = document.getElementById('countAll');
  const countAir = document.getElementById('countAir');
  const countQuick = document.getElementById('countQuick');

  // --- CANVAS INITIALIZATION & RESIZING ---
  function resizeCanvas() {
    const rect = sketchCanvas.parentElement.getBoundingClientRect();
    
    // Save existing content before resize
    let tempCanvas = document.createElement('canvas');
    tempCanvas.width = sketchCanvas.width;
    tempCanvas.height = sketchCanvas.height;
    let tempCtx = tempCanvas.getContext('2d');
    if (sketchCanvas.width > 0 && sketchCanvas.height > 0) {
      tempCtx.drawImage(sketchCanvas, 0, 0);
    }

    sketchCanvas.width = rect.width;
    sketchCanvas.height = rect.height;

    // Restore content
    if (tempCanvas.width > 0 && tempCanvas.height > 0) {
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- STORAGE & NOTES MANAGEMENT ---
  function loadNotesFromStorage() {
    const saved = localStorage.getItem('imagine_air_notes');
    if (saved) {
      try {
        notes = JSON.parse(saved);
      } catch (e) {
        notes = [];
      }
    }

    if (notes.length === 0) {
      // Create initial sample note
      const sampleNote = {
        id: 'note_' + Date.now(),
        title: 'Welcome to Air Notes ✨',
        contentText: 'Draw in thin air using your index finger! Click "Air Draw" to enable webcam hand tracking.',
        canvasDataUrl: null,
        folder: 'air',
        updatedAt: new Date().toISOString()
      };
      notes.push(sampleNote);
      saveNotesToStorage();
    }

    currentNoteId = notes[0].id;
    renderNotesList();
    loadNote(currentNoteId);
    updateFolderCounts();
  }

  function saveNotesToStorage() {
    localStorage.setItem('imagine_air_notes', JSON.stringify(notes));
    updateFolderCounts();
  }

  function updateFolderCounts() {
    countAll.textContent = notes.length;
    countAir.textContent = notes.filter(n => n.folder === 'air').length;
    countQuick.textContent = notes.filter(n => n.folder === 'quick').length;
  }

  function renderNotesList(filterQuery = '') {
    notesListEl.innerHTML = '';
    
    const filtered = notes.filter(note => 
      note.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      note.contentText.toLowerCase().includes(filterQuery.toLowerCase())
    );

    filtered.forEach(note => {
      const card = document.createElement('div');
      card.className = `note-card ${note.id === currentNoteId ? 'active' : ''}`;
      
      const dateStr = new Date(note.updatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });

      card.innerHTML = `
        <div class="note-card-title">${escapeHtml(note.title || 'Untitled Note')}</div>
        <div class="note-card-meta">
          <span>${dateStr}</span>
          <span>•</span>
          <span>${note.canvasDataUrl ? '🎨 Air Sketch' : '📝 Text'}</span>
        </div>
        <div class="note-card-preview">${escapeHtml(note.contentText || 'No additional text')}</div>
      `;

      card.addEventListener('click', () => {
        saveCurrentNoteState();
        currentNoteId = note.id;
        renderNotesList(searchInput.value);
        loadNote(currentNoteId);
      });

      notesListEl.appendChild(card);
    });
  }

  function loadNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    noteTitleInput.value = note.title || '';
    textEditor.value = note.contentText || '';

    // Clear canvas
    ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);

    // Restore canvas image if exists
    if (note.canvasDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        saveHistoryState();
      };
      img.src = note.canvasDataUrl;
    } else {
      resetHistory();
      saveHistoryState();
    }
  }

  function saveCurrentNoteState() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    note.title = noteTitleInput.value.trim() || 'Untitled Note';
    note.contentText = textEditor.value;
    note.canvasDataUrl = sketchCanvas.toDataURL('image/png');
    note.updatedAt = new Date().toISOString();

    saveNotesToStorage();
    renderNotesList(searchInput.value);
  }

  btnNewNote.addEventListener('click', () => {
    saveCurrentNoteState();

    const newNote = {
      id: 'note_' + Date.now(),
      title: 'New Air Sketch',
      contentText: '',
      canvasDataUrl: null,
      folder: 'air',
      updatedAt: new Date().toISOString()
    };

    notes.unshift(newNote);
    currentNoteId = newNote.id;
    saveNotesToStorage();
    renderNotesList(searchInput.value);
    loadNote(currentNoteId);
  });

  noteTitleInput.addEventListener('input', () => saveCurrentNoteState());
  textEditor.addEventListener('input', () => saveCurrentNoteState());

  searchInput.addEventListener('input', (e) => {
    renderNotesList(e.target.value);
  });

  // --- DRAWING ENGINE & MOUSE HANDLERS ---
  let isMouseDrawing = false;
  let lastX = 0;
  let lastY = 0;

  function startDrawing(x, y) {
    isMouseDrawing = true;
    lastX = x;
    lastY = y;

    ctx.beginPath();
    ctx.moveTo(x, y);

    setContextStyle();
  }

  function drawStroke(x, y) {
    if (!isMouseDrawing && !isAirDrawing) return;

    setContextStyle();

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);

    // Smooth quadratic curve interpolation
    const midX = (lastX + x) / 2;
    const midY = (lastY + y) / 2;
    ctx.quadraticCurveTo(lastX, lastY, midX, midY);
    ctx.stroke();

    lastX = x;
    lastY = y;
  }

  function stopDrawing() {
    if (isMouseDrawing || isAirDrawing) {
      isMouseDrawing = false;
      ctx.closePath();
      saveHistoryState();
      saveCurrentNoteState();
    }
  }

  function setContextStyle() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = activeSize * 4;
    } else if (activeTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = activeColor;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = activeSize * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = activeColor;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = activeSize;
    }
  }

  // Mouse Listeners
  sketchCanvas.addEventListener('mousedown', (e) => {
    const rect = sketchCanvas.getBoundingClientRect();
    startDrawing(e.clientX - rect.left, e.clientY - rect.top);
  });

  sketchCanvas.addEventListener('mousemove', (e) => {
    const rect = sketchCanvas.getBoundingClientRect();
    drawStroke(e.clientX - rect.left, e.clientY - rect.top);
  });

  sketchCanvas.addEventListener('mouseup', stopDrawing);
  sketchCanvas.addEventListener('mouseleave', stopDrawing);

  // Touch Listeners
  sketchCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      const rect = sketchCanvas.getBoundingClientRect();
      const touch = e.touches[0];
      startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
    }
  });

  sketchCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const rect = sketchCanvas.getBoundingClientRect();
      const touch = e.touches[0];
      drawStroke(touch.clientX - rect.left, touch.clientY - rect.top);
    }
  });

  sketchCanvas.addEventListener('touchend', stopDrawing);

  // --- TOOLBAR CONTROLS ---
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool;
    });
  });

  brushColorInput.addEventListener('input', (e) => {
    activeColor = e.target.value;
  });

  brushSizeInput.addEventListener('input', (e) => {
    activeSize = parseInt(e.target.value, 10);
  });

  btnClearCanvas.addEventListener('click', () => {
    ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    saveHistoryState();
    saveCurrentNoteState();
  });

  // --- UNDO / REDO HISTORY ---
  function resetHistory() {
    historyStack = [];
    historyStep = -1;
  }

  function saveHistoryState() {
    // Truncate redo steps
    historyStack = historyStack.slice(0, historyStep + 1);
    if (historyStack.length >= MAX_HISTORY) {
      historyStack.shift();
    }
    historyStack.push(ctx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height));
    historyStep = historyStack.length - 1;
  }

  btnUndo.addEventListener('click', () => {
    if (historyStep > 0) {
      historyStep--;
      ctx.putImageData(historyStack[historyStep], 0, 0);
      saveCurrentNoteState();
    }
  });

  btnRedo.addEventListener('click', () => {
    if (historyStep < historyStack.length - 1) {
      historyStep++;
      ctx.putImageData(historyStack[historyStep], 0, 0);
      saveCurrentNoteState();
    }
  });

  // --- EXPORT TO PNG & PDF ---
  btnExportPNG.addEventListener('click', () => {
    const link = document.createElement('a');
    const title = noteTitleInput.value.trim().replace(/\s+/g, '_') || 'air_sketch';
    link.download = `${title}.png`;
    link.href = sketchCanvas.toDataURL('image/png');
    link.click();
  });

  btnExportPDF.addEventListener('click', () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('jsPDF library loading... Please try again in a moment.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const title = noteTitleInput.value.trim() || 'Untitled Air Note';
    const textBody = textEditor.value.trim();
    const dateStr = new Date().toLocaleString();

    // PDF Header
    doc.setFillColor(30, 30, 36);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(245, 166, 35);
    doc.setFontSize(22);
    doc.text('Imagine Air Note', 15, 20);

    doc.setTextColor(160, 160, 180);
    doc.setFontSize(10);
    doc.text(`Generated on ${dateStr}`, 15, 28);

    // Title
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.text(title, 15, 52);

    // Air Drawing Artwork
    const imgData = sketchCanvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 15, 60, 180, 110);

    // Text Note Body
    if (textBody) {
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text('Note Content:', 15, 182);
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const splitText = doc.splitTextToSize(textBody, 180);
      doc.text(splitText, 15, 190);
    }

    const fileName = title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.pdf';
    doc.save(fileName);
  });

  // --- MEDIAPIPE AIR DRAWING COMPUTER VISION ENGINE ---
  btnAirDrawToggle.addEventListener('click', () => {
    if (isAirDrawActive) {
      stopAirDraw();
    } else {
      startAirDraw();
    }
  });

  btnHudClose.addEventListener('click', () => {
    stopAirDraw();
  });

  async function startAirDraw() {
    trackingStateEl.textContent = 'Starting camera...';
    airHud.classList.add('visible');
    setAirCursorVisible(false);

    try {
      if (!handsModel) {
        handsModel = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        handsModel.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65
        });

        handsModel.onResults(onHandResults);
      }

      if (!cameraInstance) {
        cameraInstance = new Camera(webcamVideo, {
          onFrame: async () => {
            if (isAirDrawActive) {
              await handsModel.send({ image: webcamVideo });
            }
          },
          width: 320,
          height: 240
        });
      }

      await cameraInstance.start();

      isAirDrawActive = true;
      btnAirDrawToggle.classList.add('active');
      airDrawLabel.textContent = 'Air Draw: ON';
      trackingStateEl.textContent = 'Hand Search...';

    } catch (err) {
      console.error('Webcam initialization failed:', err);
      alert('Unable to access webcam. Please check browser camera permissions.');
      stopAirDraw();
    }
  }

  function stopAirDraw() {
    isAirDrawActive = false;
    btnAirDrawToggle.classList.remove('active');
    airDrawLabel.textContent = 'Air Draw: OFF';
    airHud.classList.remove('visible');
    setAirCursorVisible(false);
    trackingStateEl.textContent = 'Disabled';
    smoothX = null;
    smoothY = null;
    stopDrawing();

    if (cameraInstance) {
      // Pause tracking
    }
  }

  // Mediapipe Frame Results Callback
  let lastFrameTime = performance.now();
  let frameCount = 0;

  function setAirCursorVisible(isVisible) {
    airCursor.classList.toggle('visible', isVisible);
    if (!isVisible) {
      airCursor.classList.remove('drawing');
    }
  }

  function positionAirCursor(canvasX, canvasY, canvasRect) {
    // The cursor is positioned inside the editor, while getBoundingClientRect()
    // returns viewport coordinates. Subtract the containing block's offset so
    // the cursor uses the exact same canvas-space point as the drawing engine.
    const cursorContainerRect = airCursor.offsetParent.getBoundingClientRect();
    airCursor.style.left = `${canvasRect.left - cursorContainerRect.left + canvasX}px`;
    airCursor.style.top = `${canvasRect.top - cursorContainerRect.top + canvasY}px`;
  }

  function onHandResults(results) {
    // FPS Counter
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      document.getElementById('fpsCounter').textContent = `${frameCount} FPS`;
      frameCount = 0;
      lastFrameTime = now;
    }

    // Clear Tracking Overlay Canvas
    trackingCanvas.width = webcamVideo.videoWidth || 320;
    trackingCanvas.height = webcamVideo.videoHeight || 240;
    trackingCtx.save();
    trackingCtx.clearRect(0, 0, trackingCanvas.width, trackingCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      trackingStateEl.textContent = 'Hand Tracked! ✨';
      trackingStateEl.style.color = '#30d158';

      const landmarks = results.multiHandLandmarks[0];

      // Draw skeleton overlay on camera HUD
      drawConnectors(trackingCtx, landmarks, HAND_CONNECTIONS, { color: '#f5a623', lineWidth: 2 });
      drawLandmarks(trackingCtx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 3 });

      // Extract Finger Tips
      const indexTip = landmarks[8];  // INDEX_FINGER_TIP
      const thumbTip = landmarks[4];  // THUMB_TIP
      const indexPip = landmarks[6];  // INDEX_FINGER_PIP

      // Convert Normalized Camera Coordinates to Main Sketch Canvas Space
      // Camera feed is mirrored (1 - x)
      const canvasRect = sketchCanvas.getBoundingClientRect();
      const rawX = (1 - indexTip.x) * canvasRect.width;
      const rawY = indexTip.y * canvasRect.height;

      // Apply Exponential Moving Average Smoothing to eliminate air jitter
      if (smoothX === null || smoothY === null) {
        smoothX = rawX;
        smoothY = rawY;
      } else {
        smoothX = smoothX + SMOOTH_FACTOR * (rawX - smoothX);
        smoothY = smoothY + SMOOTH_FACTOR * (rawY - smoothY);
      }

      // Position Virtual Fingertip Cursor
      positionAirCursor(smoothX, smoothY, canvasRect);
      setAirCursorVisible(true);

      // Pinch Gesture Detection: Calculate 3D distance between Index Tip and Thumb Tip
      const distance = Math.hypot(
        (indexTip.x - thumbTip.x),
        (indexTip.y - thumbTip.y),
        (indexTip.z - thumbTip.z)
      );

      // Threshold for pinch gesture (Drawing) vs hover
      const PINCH_THRESHOLD = 0.07;
      const shouldDraw = distance < PINCH_THRESHOLD;

      if (shouldDraw) {
        airCursor.classList.add('drawing');

        if (!isAirDrawing) {
          isAirDrawing = true;
          startDrawing(smoothX, smoothY);
        } else {
          drawStroke(smoothX, smoothY);
        }
      } else {
        airCursor.classList.remove('drawing');
        if (isAirDrawing) {
          isAirDrawing = false;
          stopDrawing();
        }
      }

    } else {
      trackingStateEl.textContent = 'Searching Hand...';
      trackingStateEl.style.color = '#ff9500';
      setAirCursorVisible(false);

      if (isAirDrawing) {
        isAirDrawing = false;
        stopDrawing();
      }
    }

    trackingCtx.restore();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- BOOTSTRAP APP ---
  loadNotesFromStorage();
});
