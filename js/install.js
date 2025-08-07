'use strict';

let deferredInstallPrompt = null;

// Botón de instalación
const installButton = document.getElementById('butInstall');

// Evento al hacer clic en el botón
installButton.addEventListener('click', installPWA);

// Captura el evento beforeinstallprompt y lo guarda
window.addEventListener('beforeinstallprompt', saveBeforeInstallPromptEvent);

// Guarda el evento y muestra el botón
function saveBeforeInstallPromptEvent(evt) {
  deferredInstallPrompt = evt;
  installButton.removeAttribute('');
}

// Ejecuta la instalación de la PWA
function installPWA(evt) {
  deferredInstallPrompt.prompt(); // Muestra el prompt de instalación

  // Oculta el botón
  evt.srcElement.setAttribute('', true);

  // Maneja la respuesta del usuario
  deferredInstallPrompt.userChoice.then((choice) => {
    if (choice.outcome === 'accepted') {
      console.log('✅ Instalación aceptada');
    } else {
      console.log('❌ Instalación no aceptada');
    }

    deferredInstallPrompt = null;
  });
}
window.addEventListener('appinstalled', logAppInstalled);

function logAppInstalled(evt){
    console.log("INVINCIT instalada app");
}