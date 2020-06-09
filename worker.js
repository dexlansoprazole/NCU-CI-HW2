const ipcRenderer = require('electron').ipcRenderer;
const {RBFN} = require('./modules/RBFN');
window.onerror = function(error, url, line) {
  ipcRenderer.send('error', error);
};

ipcRenderer.on('train', function(evt, arg) {
  let rbfn = new RBFN(arg.J, arg.mode, arg.opt_cfg);
  rbfn.fit(arg.dataset);
  let params = rbfn.getParams();
  evt.sender.send('train_res', {params, J: arg.J});
});