let state = {
  canvas: undefined,
  scale: 1,
  lastSavedMouse: {x: 0, y: 0, rect: undefined, inside: false },
  pathManager: undefined,  // a list of point lists: [Point[]]
  drawingNow: false,
  defaultCanvasWidth: 300,
  defaultCanvasHeight: 300,
  gestureMode: 'draw',  // 'move'
  continuousLines: false,
  floorplan: undefined,
}

class Point {
  // x and y should be stored as fractional proportions to current canvas dimentions
  constructor(x, y, timestamp) {
    this.x = x;
    this.y = y;
    this.timestamp = timestamp;
  }
}

class Path {
  constructor(continuesPreviousPath) {
    this.points = [];
    this.continuesPreviousPath = continuesPreviousPath;
  }
  addPoint(p) {
    this.points.push(p);
  }
  getFinalPoint() {
    return this.points[this.points.length - 1];
  }
}

class PathGroup {
  constructor(colour) {
    this.paths = [];
    this.colour = colour;
  }
  addPath(p) {
    this.paths.push(p);
  }
}

class PathManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.pathGroups = []; // A list of Paths
    this.currentGroup = undefined;
    this.currentPath = undefined;
    this.currentPoint = undefined;
  }
  addPoint(point) {
    const previousPoint = this.currentPoint ? this.currentPoint : point;
    this.currentPoint = point;
    this.currentPath.addPoint(point);
    this.drawNewPoint(previousPoint, point);
  }
  addPath(continuesPreviousPath) {
    const continuePrev = continuesPreviousPath && this.currentGroup.paths.length > 0;
    this.currentPath = new Path(continuePrev);
    this.currentGroup.addPath(this.currentPath);
    if (!state.continuousLines) {
      this.currentPoint = undefined;
    }
  }
  addPathGroup() {
    this.currentGroup = new PathGroup();
    this.pathGroups.push(this.currentGroup);
  }
  drawNewPoint(previousPoint, currentPoint) {
    this.ctx.moveTo(
      previousPoint.x * state.canvas.width,
      previousPoint.y * state.canvas.height
    );
    this.ctx.lineTo(
      currentPoint.x * state.canvas.width,
      currentPoint.y * state.canvas.height
    );
    this.ctx.stroke();
  }
  redrawAll() {
    this.pathGroups.forEach(group => {
      group.paths.forEach((path, index) => {
        let currentPoint = path.continuesPreviousPath ? group.paths[index - 1].getFinalPoint() : undefined;
        path.points.forEach(point => {
          const previousPoint = currentPoint ? currentPoint : point;
          currentPoint = point;
          this.drawNewPoint(previousPoint, currentPoint);
        })
      })
    })
  }
}

const mouseDown = event => {
  // document.addEventListener('mousemove', mouseMove);
  if (state.gestureMode === 'draw' && state.pathManager.pathGroups.length > 0) {
    if (event.target === state.canvas) {
      state.drawingNow = true;
      const {x, y} = eventTargetCoords(event);
      const xFraction = x / state.canvas.width;
      const yFraction = y / state.canvas.height;
      const point = new Point(
        xFraction,
        yFraction,
        new Date()
      );
      state.pathManager.addPath(state.continuousLines);
      state.pathManager.addPoint(point);
    }
  } else if (state.gestureMode === 'move') {

  }
}

const mouseUp = () => {
  state.drawingNow = false;
  // document.removeEventListener('mousemove', mouseMove);
}

const mouseMove = event => {
  state.lastSavedMouse = eventTargetCoords(event);
  if (state.gestureMode === 'draw' && state.drawingNow) {
    if (event.target === state.canvas) {
      // Event listener is on canvas, so offset coordinates are relative to canvas element
      const {x, y} = eventTargetCoords(event);
      const xFraction = x / state.canvas.width;
      const yFraction = y / state.canvas.height;
      const point = new Point(
        xFraction,
        yFraction,
        new Date()
      );
      state.pathManager.addPoint(point);
    } else {
      mouseUp();
    }
  }
}

const eventTargetCoords = event => {
  var rect = event.target.getBoundingClientRect();
  const inside = rect.left < event.clientX && rect.left + rect.width > event.clientX
    && rect.top < event.clientY && rect.top + rect.height > event.clientY;
  return {x: event.clientX - rect.left, y: event.clientY - rect.top, rect, inside };
}

const setup = () => {
  // Initialise canvas
  // const container = document.getElementById("container");
  // state.canvas.width = container.offsetWidth;
  // state.canvas.height = container.offsetHeight;
  state.canvas = document.getElementById('canvas');
  const ctx = state.canvas.getContext('2d');
  state.canvas.width = state.defaultCanvasWidth;
  state.canvas.height = state.defaultCanvasHeight;
  ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  ctx.translate(0.5, 0.5);

  // Initialise paths
  state.pathManager = new PathManager(ctx);

  // Set canvas background 
  //    - works for SVG but does not support SVG's embedded click events :(
  // const backgroundFilename = 'drawing.svg';
  // state.canvas.style.background = `url(${backgroundFilename})`;
  // state.canvas.style.backgroundRepeat = 'no-repeat';
  // state.canvas.style.backgroundSize = 'cover';

  // Set SVG object
  state.floorplan = document.getElementById('floorplan');
  state.floorplan.data = 'drawing.svg';
  state.floorplan.width = state.defaultCanvasWidth;
  state.floorplan.height = state.defaultCanvasHeight;

  // Initialise events
  state.canvas.onmousedown = mouseDown;
  state.canvas.onmouseup = mouseUp;
  document.addEventListener('mousemove', mouseMove);

  // Initialise controls
  const continuousCheckbox = document.querySelector('input[value="continuous"]');
  continuousCheckbox.onchange = () => {
    if (continuousCheckbox.checked) {
      state.continuousLines = true;
    } else {
      state.continuousLines = false;
    }
  };

  window.onkeydown = e => {
    if (state.lastSavedMouse.inside) {
      const key = e.key ? e.key : e.which;
      if (key === 'i' && state.scale < 5) {
        state.scale += 0.01;
      }else if (key === 'o' && state.scale > 1) {
        state.scale -= 0.01;
      }
      scale(event);
      state.pathManager.redrawAll();
    }
 }

  const mouseWheelListener = event => {
    if (event.ctrlKey) {
        event.preventDefault();
        event.stopImmediatePropagation();

        // Zomming in
        if (event.deltaY < 0 && state.scale < 5) {
          state.scale += 0.01;
        } else if (event.deltaY > 0 && state.scale > 1) {
          state.scale -= 0.01;
        }
        // state.scale = Math.round((state.scale + 0.00001) * 100) / 100;
        // document.getElementById('status-scale').innerText = state.scale;
        scale(event);
        state.pathManager.redrawAll();
    }
  }

  // ToDo: Run this only if desktop browser, else run touchevent handlers
  // state.canvas.addEventListener('mousewheel', event => mouseWheelListener);
}

const toggleMode = () => {
  document.getElementById('controls-modeButton').innerText = `Switch to ${state.gestureMode} mode`;
  state.gestureMode = state.gestureMode === 'draw' ? 'move' : 'draw';
}

const newVisitor = () => {
  state.pathManager.addPathGroup();
}

const scale = event => {
  // The intention is to resize the canvas but keep the same coordinate under the pointer
  // var rect = event.target.getBoundingClientRect();
  // const x = event.clientX - rect.left;
  // const y = event.clientY - rect.top;
  const {x, y, rect} = state.lastSavedMouse;
  const newWidth = state.defaultCanvasWidth * state.scale;
  const newHeight = state.defaultCanvasHeight * state.scale;
  const leftShift = (x / state.canvas.width) * (newWidth - state.canvas.width);
  const topShift = (y / state.canvas.height) * (newHeight - state.canvas.height);

  state.canvas.width = newWidth;
  state.canvas.height = newHeight;
  state.canvas.style.left = -leftShift + rect.left + 'px';
  state.canvas.style.top = -topShift + rect.top + 'px';

  state.floorplan.width = newWidth;
  state.floorplan.height = newHeight;
  state.floorplan.style.left = -leftShift + rect.left + 'px';
  state.floorplan.style.top = -topShift + rect.top + 'px';
}

const clickHotspot = item => {
  alert(`You just clicked the ${item}!`);
}