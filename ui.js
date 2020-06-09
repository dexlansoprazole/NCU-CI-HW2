const ipcRenderer = require('electron').ipcRenderer;
const path = require('path')
const fs = require('fs');
const BLOCK_SIZE = 8;
const PADDING = 100;
var path_case = "./case";
var path_dataset = "./dataset";
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
  let fileString = fs.readFileSync(filepath, "UTF-8");
  ipcRenderer.send('input', {fileString});
}

function readTrain(filepath, filename) {
  $('#inputFile-label-train').html(filename);
  let fileString = fs.readFileSync(filepath, "UTF-8");
  $('#btnTrain').off('click');
  $('#btnTrain').click(function() {
    $('#btnTrain').addClass('disabled');
    $('#btnTrain').html('<span class="spinner-border spinner-border-sm"></span>');
    $('#btnSaveParams').addClass('disabled');
    $('#btnLoadParams').addClass('disabled');
    ipcRenderer.send('train', {
      fileString,
      mode: $('#select-mode').val(),
      J: parseInt($('#cfg-j').val()),
      opt_cfg: {
        iter: parseInt($('#cfg-iter').val()),
        population_size: parseInt($('#cfg-size').val()),
        prob_mutation: parseFloat($('#cfg-mutate').val()),
        prob_crossover: parseFloat($('#cfg-crossover').val()),
        elite: 1
      }
    });
  });
}

function loadPath(filepath, filename) {
  let fileString = fs.readFileSync(filepath, "UTF-8");
  ipcRenderer.send('loadPath', {mode: $('#select-mode').val(), fileString});
}

function loadParams(filepath, filename) {
  let fileString = fs.readFileSync(filepath, "UTF-8");
  ipcRenderer.send('loadParams', {fileString});
}

function reset() {
  $('#draw-result').empty();
  $('#text-left-sensor').val(null);
  $('#text-center-sensor').val(null);
  $('#text-right-sensor').val(null);
  $('.row-sensors').addClass('d-none');
  $('.row-step').addClass('d-none');
}

function updateResult(mode = 'animate') {
  if (data == null) return;
  $('#draw-result').empty();
  $('#text-left-sensor').val(null);
  $('#text-center-sensor').val(null);
  $('#text-right-sensor').val(null);

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

ipcRenderer.on('log', function(evt, arg) {
  console.log(...arg);
});

ipcRenderer.on('error', function(evt, arg) {
  console.error(arg);
});

ipcRenderer.on('input_res', function(evt, arg){
  console.log('data:', arg);
  data = arg;
  result = null;
  ipcRenderer.send('start', $('#select-mode').val());
});

ipcRenderer.on('train_res', function(evt, arg) {
  console.log(arg);
  $('#btnTrain').removeClass('disabled');
  $('#btnTrain').html('Train');
  $('#btnSaveParams').removeClass('disabled');
  $('#btnLoadParams').removeClass('disabled');
  result = null;
  ipcRenderer.send('start', $('#select-mode').val());
});

ipcRenderer.on('load_res', function(evt, arg) {
  if (!arg)
    return;
  console.log('result:', arg);
  result = arg;
  $('#btnPlay').removeClass('disabled');
  $('#btnPath').removeClass('disabled');
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

ipcRenderer.on('loadParams_res', function(evt, arg) {
  $('#btnTrain').removeClass('disabled');
  $('#btnTrain').html('Train');
  $('#btnSaveParams').removeClass('disabled');
  $('#btnLoadParams').removeClass('disabled');
  $('#btnPlay').removeClass('disabled');
  $('#btnPath').removeClass('disabled');
  console.log(arg);
  ipcRenderer.send('start', $('#select-mode').val());
});

ipcRenderer.on('start_res', function(evt, arg) {
  if (!arg)
    return;
  console.log('result:', arg);
  result = arg;
  $('#btnPlay').removeClass('disabled');
  $('#btnPath').removeClass('disabled');
  $('#btnSavePath4D').removeClass('disabled');
  $('#btnSavePath6D').removeClass('disabled');
  $('.row-sensors').removeClass('d-none');
  $('.row-step').removeClass('d-none');
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

$('#btnPlay').click(function () {
  updateResult();
});

$('#btnPath').click(function() {
  updateResult('path');
});

$('#btnSavePath4D').click(function() {
  ipcRenderer.send('savePath4D');
});

$('#btnSavePath6D').click(function() {
  ipcRenderer.send('savePath6D');
});

$('#btnSaveParams').click(function() {
  ipcRenderer.send('saveParams');
});

$('#inputFile-case').change(function () {
  if ($(this).prop('files')[0]) {
    let inputFile = $(this).prop('files')[0];
    $(this).val('');
    readFile(inputFile.path, inputFile.name);
  }
});

$('#inputFile-train').change(function() {
  if ($(this).prop('files')[0]) {
    let inputFile = $(this).prop('files')[0];
    $(this).val('');
    readTrain(inputFile.path, inputFile.name);
    $('#btnPlay').addClass('disabled');
    $('#btnPath').addClass('disabled');
  }
});

$('#inputFile-loadPath').change(function() {
  if ($(this).prop('files')[0]) {
    let inputFile = $(this).prop('files')[0];
    $(this).val('');
    loadPath(inputFile.path, inputFile.name);
  }
});

$('#inputFile-loadParams').change(function() {
  if ($(this).prop('files')[0]) {
    let inputFile = $(this).prop('files')[0];
    $(this).val('');
    loadParams(inputFile.path, inputFile.name);
  }
});

$('#select-mode').change(function() {
  let mode = $('#select-mode').val();
  reset();
  $('#btnPlay').addClass('disabled');
  $('#btnPath').addClass('disabled');
  $('#btnSaveParams').addClass('disabled');
  $('#btnSavePath4D').addClass('disabled');
  $('#btnSavePath6D').addClass('disabled');
  switch (mode) {
    case 'fuzzy':
      $('#row-train').addClass('d-none');
      $('#row-train-cfg').addClass('d-none');
      ipcRenderer.send('start', $('#select-mode').val());
      break;
    default:
      $('#row-train').removeClass('d-none');
      $('#row-train-cfg').removeClass('d-none');
      break;
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

fs.readdir(path_dataset, function(err, items) {
  items.forEach(item => {
    let $dropdown_item_train = $($.parseHTML('<a class="dropdown-item dropdown-item-train" href="#" filename="' + item + '" filepath="' + path.join(path_dataset, item) + '">' + item.slice(0, -4) + '</a>'));
    $dropdown_item_train.click(function() {
      let filename = $(this).attr('filename');
      let filepath = $(this).attr('filepath');
      readTrain(filepath, filename);
      $('#btnPlay').addClass('disabled');
      $('#btnPath').addClass('disabled');
    });
    $('#dropdown-menu-train').append($dropdown_item_train);
  });
});
readFile('./case/case01.txt', 'case01.txt');
readTrain('./dataset/train4dAll.txt', 'train4dAll.txt');

ipcRenderer.send('start', $('#select-mode').val());