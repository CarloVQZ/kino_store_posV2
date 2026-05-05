try {
  const electron = require('electron')
  console.log('Electron requerido exitosamente')
  console.log('Tipo:', typeof electron)
  console.log('Constructor:', electron.constructor.name)
  console.log('Propiedades:', Object.getOwnPropertyNames(electron).filter(p => !p.match(/^\d+$/)).slice(0, 20))
} catch (e) {
  console.error('Error:', e.message)
}
