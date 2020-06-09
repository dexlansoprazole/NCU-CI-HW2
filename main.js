const {app, BrowserWindow, Menu, ipcMain, globalShortcut, dialog} = require('electron')
const fs = require('fs'); 
const path = require('path'); 
if (!app.isPackaged)
  require('electron-reload')(__dirname, {ignored: [/outputs|[\/\\]\./, /weights|[\/\\]\./, /dataset|[\/\\]\./]});
const {Fuzzy} = require('./modules/Fuzzy');
const {RBFN} = require('./modules/RBFN');

let mainWindow, workerWindow;
let data = null;
let result = null;
let rbfn = null;
let fuzzy = new Fuzzy();

function createWindow() {
  Menu.setApplicationMenu(null)
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: { nodeIntegration: true }
  })
  mainWindow.loadFile('ui.html')
  if (!app.isPackaged)
    mainWindow.webContents.openDevTools()
  
  workerWindow = new BrowserWindow({
    show: false,
    webPreferences: {nodeIntegration: true},
  });
  workerWindow.loadFile('worker.html');

  globalShortcut.register('f5', function() {
    mainWindow.reload();
    workerWindow.close();
    workerWindow = new BrowserWindow({
      show: false,
      webPreferences: {nodeIntegration: true},
    });
    workerWindow.loadFile('worker.html');
  })

  mainWindow.on('closed', function() {
    mainWindow = null;
    if (workerWindow != null)
      workerWindow.close();
  })

  workerWindow.on('closed', () => {
    workerWindow = null;
  })
}

app.on('ready', function() {
  ipcMain.on('log', (evt, arg) => {
    console.log(...arg);
    mainWindow.webContents.send('log', arg);
  })

  ipcMain.on('error', (evt, arg) => {
    console.error(arg);
    mainWindow.webContents.send('error', arg);
  })

  ipcMain.on('input', (evt, arg) => {
    data = parseData(arg)
    mainWindow.webContents.send('input_res', data);
  })

  ipcMain.on('savePath4D', (evt, arg) => {
    let data4D = result.map(r => [r.sensors.center.val, r.sensors.right.val, r.sensors.left.val, r.handle].join(' ')).join('\n');
    let defaultPath = '*/train4D.txt';
    let outputPath = dialog.showSaveDialogSync(mainWindow, {defaultPath});
    if (outputPath)
      fs.writeFileSync(path.join(outputPath), data4D);
  })

  ipcMain.on('savePath6D', (evt, arg) => {
    let data6D = result.map(r => [r.x, r.y, r.sensors.center.val, r.sensors.right.val, r.sensors.left.val, r.handle].join(' ')).join('\n');
    let defaultPath = '*/train6D.txt';
    let outputPath = dialog.showSaveDialogSync(mainWindow, {defaultPath});
    if (outputPath)
      fs.writeFileSync(path.join(outputPath), data6D);
  })

  ipcMain.on('loadPath', (evt, arg) => {
    let lines = arg.fileString.split("\n");
    let save = lines.map(l => {
      let d = l.trim().split(' ').map(v => parseFloat(v))
      return d[d.length - 1];
    });
    let res = start(arg.mode, save);
    mainWindow.webContents.send('load_res', res.result);
  })

  ipcMain.on('saveParams', (evt, arg) => {
    let params = rbfn.getParams(); 
    let defaultPath = '*/RBFN_params.txt';
    let outputPath = dialog.showSaveDialogSync(mainWindow, {defaultPath});
    if (outputPath)
      fs.writeFileSync(outputPath, params);
  })

  ipcMain.on('loadParams', (evt, arg) => {
    let params = parseParams(arg.fileString);
    rbfn = new RBFN(params.w.length, undefined, undefined, params);
    mainWindow.webContents.send('loadParams_res', {params});
  })

  ipcMain.on('train', (evt, arg) => {
    workerWindow.webContents.send('train', {mode: arg.mode, J: arg.J, opt_cfg: arg.opt_cfg, dataset: parseDataset(arg.fileString)});
  })

  ipcMain.on('train_res', (evt, arg) => {
    let params = parseParams(arg.params);
    rbfn = new RBFN(arg.J, undefined, undefined, params);
    mainWindow.webContents.send('train_res', {params});
  })

  ipcMain.on('start', (evt, arg) => {
    let res = start(arg);
    result = res.result;
    mainWindow.webContents.send('start_res', result);
  })

  ipcMain.on('create_dataset', (evt, arg) => {
    let data4D = new Array();
    let data6D = new Array();
    let count = 0;
    for (let i = 0; i < 20; i++) {
      sensor_length = {center: rand(5, 10), left: rand(10, 20), right: rand(10, 20)};
      fuzzy = new Fuzzy(sensor_length);
      let res = start(arg);
      if(res.isFinished){
        console.log(++count);
        data4D.push(res.result.map(r => [r.sensors.center.val, r.sensors.right.val, r.sensors.left.val, r.handle].join(' ')).join('\n'));
        data6D.push(res.result.map(r => [r.x, r.y, r.sensors.center.val, r.sensors.right.val, r.sensors.left.val, r.handle].join(' ')).join('\n'));
      }
      else
        i--;
    }
    let outputPath = app.isPackaged ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'dataset') : './dataset';
    if (!fs.existsSync(outputPath))
      fs.mkdirSync(outputPath);
    fs.writeFileSync(path.join(outputPath, 'myTrain4DAll.txt'), data4D.join('\n'));
    fs.writeFileSync(path.join(outputPath, 'myTrain6DAll.txt'), data6D.join('\n'));
    mainWindow.webContents.send('create_dataset_res');
  })

  createWindow();
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (mainWindow === null) createWindow()
})

function rand(a, b) {
  return (b - a) * Math.random() + a;
}

function parseData(arg) {
  let rawText = arg.fileString;
  let lines = rawText.split("\n");
  [x, y, degree] = lines[0].trim().split(',').map(v => parseFloat(v));
  let start = {x, y, degree};
  let finish = [
    lines[1].trim().split(',').map(v => parseInt(v)),
    lines[2].trim().split(',').map(v => parseInt(v))
  ]
  finish = finish.map(v => {
    [x, y] = v;
    return {x, y};
  });
  finish = {
    topLeft: finish[0],
    bottomRight: finish[1]
  }
  let corners = new Array();
  for (let i = 3; i < lines.length; i++) {
    [x, y] = lines[i].trim().split(',').map(v => parseInt(v));
    corners.push({x, y});
  }
  return {start, finish, corners};
}

function parseDataset(rawText) {
  let lines = rawText.split("\n");
  let datas = lines.map(line => {
    line = line.split(' ').map(v => parseFloat(v));
    let y = line.pop();
    let x = line.slice();
    return {x, y};
  });
  return datas;
}

function parseParams(rawText) {
  let lines = rawText.split("\n");
  let theta = parseFloat(lines.shift());
  let w = [];
  let m = [];
  let sigma = [];
  lines.forEach(line => {
    line = line.split(' ').map(v => parseFloat(v));
    w.push(line.shift());
    sigma.push(line.pop());
    m.push(line);
  });
  return {theta, w, m, sigma};
}

function start(mode = 'fuzzy', save = null) {
  if (!data)
    return null;
  let finishCorners = [
    {x: data.finish.topLeft.x, y: data.finish.topLeft.y},
    {x: data.finish.bottomRight.x, y: data.finish.topLeft.y},
    {x: data.finish.bottomRight.x, y: data.finish.bottomRight.y},
    {x: data.finish.topLeft.x, y: data.finish.bottomRight.y},
    {x: data.finish.topLeft.x, y: data.finish.topLeft.y}
  ]

  let isFinished = false;
  let res = new Array();
  let sensors = getSensors(...Object.values(data.start));
  let h = null;
  switch (mode) {
    case 'fuzzy':
      h = fuzzy.handle(sensors);
      break;
    case 'gene':
      h = rbfn.handle(data.start.x, data.start.y, sensors);
      break;
    case 'pso':
      h = rbfn.handle(data.start.x, data.start.y, sensors);
      break;
  }
  res.push({...data.start, sensors, handle: save ? save[0] : h});
  for (let i = 1; i < (save ? save.length : 10000); i++){
    let {x, y} = res[res.length - 1];
    if (!save && isCollision(x, y, data.corners) && i !== 1) break;
    if (!save && isCollision(x, y, finishCorners)) {
      isFinished = true;
      break;
    }
    let prev = res[res.length - 1];
    res.push(next(mode, prev.x, prev.y, prev.degree, prev.handle, save ? save[i] : null));
  }
  return {result: res, isFinished};
}

function next(mode, x, y, degree, handle, save) {
  let theta = toRadians(handle);
  let radian = toRadians(degree);
  x = x + Math.cos(radian + theta) + Math.sin(radian) * Math.sin(theta);
  y = y + Math.sin(radian + theta) - Math.cos(radian) * Math.sin(theta);
  radian = radian - Math.asin(2 * Math.sin(theta) / 6);
  let sensors = getSensors(x, y, toDegrees(radian));
  let h = null;
  switch (mode) {
    case 'fuzzy':
      h = fuzzy.handle(sensors);
      break;
    case 'gene':
      h= rbfn.handle(x, y, sensors);
      break;
    case 'pso':
      h = rbfn.handle(x, y, sensors);
      break;
  }
  return {x, y, degree: toDegrees(radian), sensors, handle: save != null ? save : h};
}

function isCollision(x, y, corners) {
  let res = false;
  let edges = corners.map((c, i, a) => {
    if (i === 0)
      return null;
    return [{x: a[i - 1].x, y: a[i - 1].y}, {x: c.x, y: c.y}];
  }).slice(1, corners.length);
  edges.forEach(edge => {
    let footPoint = getFootPoint({x, y}, edge[0], edge[1]);
    if (
      footPoint.x >= Math.min(...edge.map(e => e.x)) &&
      footPoint.x <= Math.max(...edge.map(e => e.x)) &&
      footPoint.y >= Math.min(...edge.map(e => e.y)) &&
      footPoint.y <= Math.max(...edge.map(e => e.y))) {
      let dis = getDistanceByPointToLine({x, y}, ...edge);
      if (dis <= 3){
        res = true;
        return;
      }
      }
  });
  data.corners.forEach(c => {
    let dis = ((x - c.x)**2 + (y - c.y)**2)**0.5;
    if (dis <= 3) {
      res = true;
      return;
    }
  });
  return res;
}

// https://blog.csdn.net/hsg77/article/details/90376109
function getFootPoint(point, pnt1, pnt2) {
  let A = pnt2.y - pnt1.y;
  let B = pnt1.x - pnt2.x;
  let C = pnt2.x * pnt1.y - pnt1.x * pnt2.y;
  if (A * A + B * B < 1e-13) {
    return pnt1;
  }
  else if (Math.abs(A * point.x + B * point.y + C) < 1e-13) {
    return point;
  }
  else {
    let x = (B * B * point.x - A * B * point.y - A * C) / (A * A + B * B);
    let y = (-A * B * point.x + A * A * point.y - B * C) / (A * A + B * B);
    return {x, y};
  }
}

// https://blog.csdn.net/hsg77/article/details/90376109
function getDistanceByPointToLine(point, pnt1, pnt2)
{
  let dis = 0;
  if (pnt1.x == pnt2.x) {
    if (pnt1.y == pnt2.y) {
      let dx = point.x - pnt1.x;
      let dy = point.y - pnt1.y;
      dis = Math.sqrt(dx * dx + dy * dy);
    }
    else
      dis = Math.abs(point.x - pnt1.x);
  }
  else {
    let lineK = (pnt2.y - pnt1.y) / (pnt2.x - pnt1.x);
    let lineC = (pnt2.x * pnt1.y - pnt1.x * pnt2.y) / (pnt2.x - pnt1.x);
    dis = Math.abs(lineK * point.x - point.y + lineC) / (Math.sqrt(lineK * lineK + 1));
  }
  return dis;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians) {
  return radians / (Math.PI / 180);
}

function getSensors(x, y, degree) {
  let dis = 1000; 
  let center = {
    x: x + dis * Math.cos(toRadians(degree)),
    y: y + dis * Math.sin(toRadians(degree))
  }
  let left = {
    x: x + dis * Math.cos(toRadians(degree+45)),
    y: y + dis * Math.sin(toRadians(degree+45))
  }
  let right = {
    x: x + dis * Math.cos(toRadians(degree-45)),
    y: y + dis * Math.sin(toRadians(degree-45))
  }
  let reses = getSensorRes(x, y, [center, left, right]);
  let sensors = {
    center: {
      end: center,
      val: reses[0]
    },
    left: {
      end: left,
      val: reses[1]
    },
    right: {
      end: right,
      val: reses[2]
    },
  }
  return sensors;
}

function getSensorRes(x, y, sensors) {
  let edges = data.corners.map((c, i, a) => {
    if (i === 0)
      return null;
    return [{x: a[i - 1].x, y: a[i - 1].y}, {x: c.x, y: c.y}];
  }).slice(1, data.corners.length);

  let reses = new Array();
  sensors.forEach(sensor => {
    let intersects = new Array();
    edges.forEach(edge => {
      let itst = intersect({x, y}, sensor, edge[0], edge[1]);
      if (itst)
        intersects.push(itst);
    });
    distances = intersects.map(i => ((x - i.x) ** 2 + (y - i.y) ** 2) ** 0.5);
    reses.push(Math.min(...distances));
  });
  return reses;
}

// Given three colinear points p, q, r, the function checks if 
// point q lies on line segment 'pr' 
function onSegment(p, q, r)
{
  if (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y))
    return true;

  return false;
}

// https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
// To find orientation of ordered triplet (p, q, r). 
// The function returns following values 
// 0 --> p, q and r are colinear 
// 1 --> Clockwise 
// 2 --> Counterclockwise 
function orientation(p, q, r)
{
  // See https://www.geeksforgeeks.org/orientation-3-ordered-points/ 
  // for details of below formula. 
  let val = (q.y - p.y) * (r.x - q.x) -
    (q.x - p.x) * (r.y - q.y);

  if (val == 0) return 0; // colinear 

  return (val > 0) ? 1 : 2; // clock or counterclock wise 
}

// https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
// The main function that returns true if line segment 'p1q1' 
// and 'p2q2' intersect. 
function intersect(p1, q1, p2, q2)
{
  let res = false;
  // Find the four orientations needed for general and 
  // special cases 
  let o1 = orientation(p1, q1, p2);
  let o2 = orientation(p1, q1, q2);
  let o3 = orientation(p2, q2, p1);
  let o4 = orientation(p2, q2, q1);

  // General case 
  if (o1 != o2 && o3 != o4)
    res = true;

  // Special Cases 
  // p2 and q2 both lies on segment p1q1 
  if ((o1 == 0 && onSegment(p1, p2, q1)) && (o2 == 0 && onSegment(p1, q2, q1))) {
    let disP2 = ((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2) ** 0.5;
    let disQ2 = ((p1.x - q2.x) ** 2 + (p1.y - q2.y) ** 2) ** 0.5;
    return disP2 < disQ2 ? p2 : q2;
  }

  if (res) {
    let denominator = ((q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y));
    let ua = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / denominator;
    let x = p1.x + ua * (q1.x - p1.x);
    let y = p1.y + ua * (q1.y - p1.y);
    return {x, y}
  }

  return res; // Doesn't fall in any of the above cases 
}