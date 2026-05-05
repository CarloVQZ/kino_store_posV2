const path = require('path')
const electronPath = require('electron')
console.log('electronPath:', electronPath)
console.log('typeof:', typeof electronPath)

// Electron debe ser accesible como binario
// No como un require normal
const { spawn } = require('child_process')

console.log('Intentando usar electron CLI...')
