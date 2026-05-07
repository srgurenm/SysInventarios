/**
 * storage.js — Subida de imágenes a Firebase Storage
 */

/**
 * Sube una imagen al path dado y retorna la URL pública de descarga.
 * @param {File} file
 * @param {string} inventoryId
 * @param {string} deviceId
 * @param {number} index
 */
async function uploadDeviceImage(file, inventoryId, deviceId, index) {
  const ext  = file.name.split('.').pop();
  const path = `inventories/${inventoryId}/devices/${deviceId}/img_${index}.${ext}`;
  const ref  = storage.ref(path);
  const snap = await ref.put(file);
  return snap.ref.getDownloadURL();
}

/**
 * Sube múltiples imágenes y retorna array de URLs.
 */
async function uploadDeviceImages(files, inventoryId, deviceId) {
  const urls = await Promise.all(
    [...files].map((f, i) => uploadDeviceImage(f, inventoryId, deviceId, i))
  );
  return urls;
}

/**
 * Elimina todas las imágenes de un dispositivo.
 */
async function deleteDeviceImages(inventoryId, deviceId) {
  const folderRef = storage.ref(`inventories/${inventoryId}/devices/${deviceId}`);
  try {
    const list = await folderRef.listAll();
    await Promise.all(list.items.map(item => item.delete()));
  } catch {
    // Ignore if folder doesn't exist
  }
}
