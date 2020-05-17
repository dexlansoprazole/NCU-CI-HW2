const ipcRenderer = require('electron').ipcRenderer;
const path = require('path')
const fs = require('fs');
const BLOCK_SIZE = 8;
const PADDING = 100;
var path_case = "./case";
var path_save = "./save";
var data = null;
var result = null;

document.addEventListener("keydown", function(e) {
  if (e.which === 123) {
    require('electron').remote.getCurrentWindow().toggleDevTools();
  } else if (e.which === 116) {
    location.reload();
  }
});

function readFile(filepath, filename) {
  $('#inputFile-label-case').html(filename);
  $('#inputFile-label-save').html('');
  let fileString = fs.readFileSync(filepath, "UTF-8");
  ipcRenderer.send('input', {fileString});
}

function loadFile(filepath, filename) {
  $('#inputFile-label-save').html(filename);
  let fileString = fs.readFileSync(filepath, "UTF-8");
  ipcRenderer.send('load', {fileString});
}

function reset() {
  $('#draw-result').empty();
  $('#text-left-sensor').val(null);
  $('#text-center-sensor').val(null);
  $('#text-right-sensor').val(null);
}

function updateResult(mode = 'animate') {
  if (data == null) return;
  reset();

  let svg = $('#draw-result').svg('get');
  let min = {
    x: Math.min(...data.corners.map(c => c.x)),
    y: Math.min(...data.corners.map(c => c.y))
  }
  let width = (Math.max(...data.corners.map(c => c.x)) - min.x) * BLOCK_SIZE + PADDING * 2;
  let height = (Math.max(...data.corners.map(c => c.y)) - min.y) * BLOCK_SIZE + PADDING * 2;
  let offset = {
    x: min.x < 0 ? (-min.x) * BLOCK_SIZE : 0,
    y: min.y < 0 ? (-min.y) * BLOCK_SIZE : 0
  }
  $(svg.root()).width(width);
  $(svg.root()).height(height);

  // Draw track
  svg.polyline(
    data.corners.map(c => getCoordinate(c.x, c.y, offset, svg)),
    {fill: 'none', stroke: 'black', strokeWidth: 1}
  );
  for (corner of data.corners) {
    svg.circle(...getCoordinate(corner.x, corner.y, offset, svg), 1, {fill: 'black', stroke: 'black', strokeWidth: 5});
  }

  // Draw finish area
  svg.rect(
    ...getCoordinate(data.finish.topLeft.x, data.finish.topLeft.y, offset, svg),
    Math.abs(data.finish.bottomRight.x - data.finish.topLeft.x) * BLOCK_SIZE, Math.abs(data.finish.bottomRight.y - data.finish.topLeft.y) * BLOCK_SIZE,
    0, 0,
    {fill: 'none', stroke: 'red', strokeWidth: 1}
  );

  // Draw car
  let circle = svg.circle(...getCoordinate(data.start.x, data.start.y, offset, svg), 3 * BLOCK_SIZE, {fill: 'none', stroke: 'green', strokeWidth: 2});
  let line = svg.line(
    ...getCoordinate(data.start.x, data.start.y, offset, svg),
    ...getCoordinate(data.start.x, data.start.y + 6, offset, svg),
    {stroke: 'green', strokeWidth: 2, transform: 'rotate(' + (90 - data.start.degree) + ', ' + getCoordinate(data.start.x, data.start.y, offset, svg).toString() + ')'}
  );
  
  if (result) {
    result.forEach((r, i, a) => {
      let color = (i === a.length - 1 ? 'red' : 'green');
      switch (mode) {
        case 'animate':
          // move car
          if (i !== 0) {
            $(circle).animate({
              svgStroke: color,
              svgCx: getCoordinate(r.x, r.y, offset, svg)[0],
              svgCy: getCoordinate(r.x, r.y, offset, svg)[1]
            }, {
              duration: 50,
              start: () => {
                $('#text-left-sensor').val(r.sensors.left.val);
                $('#text-center-sensor').val(r.sensors.center.val);
                $('#text-right-sensor').val(r.sensors.right.val);
                $('#range').val(i);
                $('#step').html(i + 1);
              }
            });
            $(line).animate({
              svgStroke: color,
              svgX1: getCoordinate(r.x, r.y, offset, svg)[0],
              svgY1: getCoordinate(r.x, r.y, offset, svg)[1],
              svgX2: getCoordinate(r.x, r.y + 6, offset, svg)[0],
              svgY2: getCoordinate(r.x, r.y + 6, offset, svg)[1],
              svgTransform: 'rotate(' + (90 - r.degree) + ', ' + getCoordinate(r.x, r.y, offset, svg).toString() + ')'
            }, 50);
          }
          break;
        case 'path':
          // Draw path
          $('#text-left-sensor').val(r.sensors.left.val);
          $('#text-center-sensor').val(r.sensors.center.val);
          $('#text-right-sensor').val(r.sensors.right.val);
          $('#range').val(i);
          $('#step').html(i + 1);
          svg.circle(...getCoordinate(r.x, r.y, offset, svg), 3 * BLOCK_SIZE, {fill: 'none', stroke: color, strokeWidth: 2});
          svg.line(
            ...getCoordinate(r.x, r.y, offset, svg),
            ...getCoordinate(r.x, r.y + 6, offset, svg),
            {stroke: color, strokeWidth: 2, transform: 'rotate(' + (90 - r.degree) + ', ' + getCoordinate(r.x, r.y, offset, svg).toString() + ')'}
          );
          break;
      }

      // Draw sensors
      // for (sensor of Object.values(r.sensors)) {
      //   svg.line(
      //     ...getCoordinate(r.x, r.y, offset, svg),
      //     ...getCoordinate(sensor.end.x, sensor.end.y, offset, svg),
      //     {fill: 'lime', stroke: 'lime', strokeWidth: 1}
      //   );
      // }
    });
  }
}

function drawStep(step) {
  if (result == null) return;
  $('#draw-result').empty();
  let svg = $('#draw-result').svg('get');
  let min = {
    x: Math.min(...data.corners.map(c => c.x)),
    y: Math.min(...data.corners.map(c => c.y))
  }
  let width = (Math.max(...data.corners.map(c => c.x)) - min.x) * BLOCK_SIZE + PADDING * 2;
  let height = (Math.max(...data.corners.map(c => c.y)) - min.y) * BLOCK_SIZE + PADDING * 2;
  let offset = {
    x: min.x < 0 ? (-min.x) * BLOCK_SIZE : 0,
    y: min.y < 0 ? (-min.y) * BLOCK_SIZE : 0
  }
  $(svg.root()).width(width);
  $(svg.root()).height(height);

  // Draw track
  svg.polyline(
    data.corners.map(c => getCoordinate(c.x, c.y, offset, svg)),
    {fill: 'none', stroke: 'black', strokeWidth: 1}
  );
  for (corner of data.corners) {
    svg.circle(...getCoordinate(corner.x, corner.y, offset, svg), 1, {fill: 'black', stroke: 'black', strokeWidth: 5});
  }

  // Draw finish area
  svg.rect(
    ...getCoordinate(data.finish.topLeft.x, data.finish.topLeft.y, offset, svg),
    Math.abs(data.finish.bottomRight.x - data.finish.topLeft.x) * BLOCK_SIZE, Math.abs(data.finish.bottomRight.y - data.finish.topLeft.y) * BLOCK_SIZE,
    0, 0,
    {fill: 'none', stroke: 'red', strokeWidth: 1}
  );

  // Draw car
  let r = result[step];
  let color = (step == result.length - 1 ? 'red' : 'green');
  $('#text-left-sensor').val(r.sensors.left.val);
  $('#text-center-sensor').val(r.sensors.center.val);
  $('#text-right-sensor').val(r.sensors.right.val);
  $('#range').val(step);
  $('#step').html(step+1);
  svg.circle(...getCoordinate(r.x, r.y, offset, svg), 3 * BLOCK_SIZE, {fill: 'none', stroke: color, strokeWidth: 2});
  svg.line(
    ...getCoordinate(r.x, r.y, offset, svg),
    ...getCoordinate(r.x, r.y + 6, offset, svg),
    {stroke: color, strokeWidth: 2, transform: 'rotate(' + (90 - r.degree) + ', ' + getCoordinate(r.x, r.y, offset, svg).toString() + ')'}
  );
}

function getCoordinate(x, y, offset, svg) {
  return [PADDING + offset.x + x * BLOCK_SIZE, $(svg.root()).height() - (PADDING + offset.y + y * BLOCK_SIZE)];
}

ipcRenderer.on('input_res', function(evt, arg){
  console.log('data:', arg);
  data = arg;
  result = null;
  // ipcRenderer.send('start');
});

ipcRenderer.on('train_res', function(evt, arg) {
  console.log('train_set:', arg);
});

ipcRenderer.on('load_res', function(evt, arg) {
  if (!arg)
    return;
  console.log('result:', arg);
  result = arg;
  $('#range').attr('max', result.length - 1);
  $('#range').off('input');
  $('#range').on('input', evt => {
    let r = result[evt.target.value];
    $('#text-left-sensor').val(r.sensors.left.val);
    $('#text-center-sensor').val(r.sensors.center.val);
    $('#text-right-sensor').val(r.sensors.right.val);
    $('step').html(evt.target.value);
    drawStep(parseInt(evt.target.value));
  })
  $('#draw-result').svg({onLoad: () => drawStep(0)});
  drawStep(0)
});

ipcRenderer.on('start_res', function(evt, arg) {
  if (!arg)
    return;
  console.log('result:', arg);
  result = arg;
  $('#range').attr('max', result.length - 1);
  $('#range').off('input');
  $('#range').on('input', evt => {
    let r = result[evt.target.value];
    $('#text-left-sensor').val(r.sensors.left.val);
    $('#text-center-sensor').val(r.sensors.center.val);
    $('#text-right-sensor').val(r.sensors.right.val);
    $('step').html(evt.target.value);
    drawStep(parseInt(evt.target.value));
  })
  $('#draw-result').svg({onLoad: () => drawStep(0)});
  drawStep(0);
});

$('#btnStart').click(function () {
  updateResult();
});

$('#btnPath').click(function() {
  updateResult('path');
});

$('#inputFile-case').change(function () {
  if ($(this).prop('files')[0]) {
    let inputFile = $(this).prop('files')[0];
    $(this).val('');
    readFile(inputFile.path, inputFile.name);
  }
});

$('#inputFile-save').change(function() {
  if ($(this).prop('files')[0]) {
    let inputFile = $(this).prop('files')[0];
    $(this).val('');
    loadFile(inputFile.path, inputFile.name);
  }
});

fs.readdir(path_case, function(err, items) {
  items.forEach(item => {
    let $dropdown_item_case = $($.parseHTML('<a class="dropdown-item dropdown-item-case" href="#" filename="' + item + '" filepath="' + path.join(path_case, item) + '">' + item.slice(0, -4) + '</a>'));
    $dropdown_item_case.click(function () {
      let filename = $(this).attr('filename');
      let filepath = $(this).attr('filepath');
      readFile(filepath, filename);
    });
    $('#dropdown-menu-case').append($dropdown_item_case);
  });
});

fs.readdir(path_save, function(err, items) {
  items.forEach(item => {
    let $dropdown_item_save = $($.parseHTML('<a class="dropdown-item dropdown-item-save" href="#" filename="' + item + '" filepath="' + path.join(path_save, item) + '">' + item.slice(0, -4) + '</a>'));
    $dropdown_item_save.click(function() {
      let filename = $(this).attr('filename');
      let filepath = $(this).attr('filepath');
      loadFile(filepath, filename);
    });
    $('#dropdown-menu-save').append($dropdown_item_save);
  });
});
readFile('./case/case01.txt', 'case01.txt');

// test
let fileString = fs.readFileSync('./dataset/train4dAll.txt', "UTF-8");
ipcRenderer.send('train', {fileString});