function logger(message, ...optionalParams) {
  const ipcRenderer = require('electron').ipcRenderer;
  ipcRenderer.send('log', [message, ...optionalParams]);
}

module.exports = logger;