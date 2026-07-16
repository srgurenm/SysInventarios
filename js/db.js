/**
 * db.js — Operaciones Firestore
 * CRUD para inventarios y dispositivos
 */

// Helpers para Firestore
const getInventoriesRef = () => db.collection('inventories');
const getInventoryRef = (id) => getInventoriesRef().doc(id);
const getDevicesRef = (inventoryId) => getInventoryRef(inventoryId).collection('devices');
const getDeviceRef = (inventoryId, deviceId) => getDevicesRef(inventoryId).doc(deviceId);
const getLogsRef = () => db.collection('system_logs');
const getLogRef = (logId) => getLogsRef().doc(logId);

// ==========================================
// UTILS / VALIDATION / LOGGING
// ==========================================

/**
 * Valida los datos del dispositivo antes de guardar.
 */
function validateDeviceData(data) {
  if (!data.universitySerial || !data.universitySerial.trim()) throw new Error('Serial Universitario es requerido.');
  if (!data.brand || !data.brand.trim()) throw new Error('Marca es requerida.');
  if (!data.type || !data.type.trim()) throw new Error('Tipo de dispositivo es requerido.');
  return true;
}

/**
 * Registra una acción de usuario en los logs.
 */
async function logUserAction(action, details, uid, email) {
  try {
    await getLogsRef().add({
      type: 'user_action',
      action,
      details,
      user: { uid, email },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("Fallo al guardar log de acción:", e);
  }
}

// ==========================================
// INVENTORIES
// ==========================================
// La contraseña se hashea con bcryptjs antes de guardar.
// */
// Helper to get bcrypt object (it might be global or under dcodeIO)
const getBcrypt = () => {
  if (typeof bcrypt !== 'undefined') return bcrypt;
  if (typeof dcodeIO !== 'undefined' && dcodeIO.bcrypt) return dcodeIO.bcrypt;
  throw new Error('La librería de encriptación (bcrypt) no se ha cargado correctamente.');
};

/**
 * Crea un nuevo inventario.
 * La contraseña se hashea con bcryptjs antes de guardar.
 */
async function createInventory(name, description, password, uid) {
  const hasher = getBcrypt();
  const salt = hasher.genSaltSync(10);
  const passwordHash = hasher.hashSync(password, salt);

  const ref = await getInventoriesRef().add({
    name,
    description,
    passwordHash,
    createdBy: uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    deviceCount: 0,
  });
  return ref.id;
}

/**
 * Lista los inventarios del usuario autenticado.
 * MEJORA #3: Filtra por `createdBy` para que cada usuario vea únicamente los suyos.
 * @param {string} uid - UID del usuario autenticado.
 * @param {Function} callback
 */
function listenInventories(uid, callback) {
  return getInventoriesRef()
    .where('createdBy', '==', uid)
    .orderBy('updatedAt', 'desc')
    .onSnapshot(snap => {
      const inventories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(inventories);
    }, err => console.error('listenInventories:', err));
}

/**
 * Obtiene un inventario por ID.
 */
async function getInventory(id) {
  const doc = await getInventoryRef(id).get();
  if (!doc.exists) throw new Error('Inventario no encontrado');
  return { id: doc.id, ...doc.data() };
}

/**
 * Verifica la contraseña de un inventario.
 * Retorna true si coincide, false en caso contrario.
 */
async function verifyInventoryPassword(inventoryId, password) {
  const inv = await getInventory(inventoryId);
  const hasher = getBcrypt();
  return hasher.compareSync(password, inv.passwordHash);
}

/**
 * Actualiza metadatos de un inventario.
 */
async function updateInventory(id, data) {
  await getInventoryRef(id).update({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Elimina un inventario y todos sus dispositivos.
 * Usa batched writes para consistencia y soporta más de 500 dispositivos.
 */
async function deleteInventory(id) {
  const devicesSnap = await getDevicesRef(id).get();
  
  // Dividir en bloques de 499
  const docs = devicesSnap.docs;
  for (let i = 0; i < docs.length; i += 499) {
    const chunk = docs.slice(i, i + 499);
    const batch = db.batch();
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  
  await getInventoryRef(id).delete();
}

// DEVICES

/**
 * Agrega un dispositivo a un inventario.
 */
async function addDevice(inventoryId, deviceData, uid, email) {
  validateDeviceData(deviceData);
  
  const ref = await getDevicesRef(inventoryId).add({
    ...deviceData,
    createdBy: uid,
    createdByEmail: email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Log action
  await logUserAction('add_device', { deviceId: ref.id, inventoryId }, uid, email);

  // Update inventory counters
  const invUpdate = {
    deviceCount: firebase.firestore.FieldValue.increment(1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (deviceData.status === 'Funcional') {
    invUpdate.funcCount = firebase.firestore.FieldValue.increment(1);
  }
  await getInventoryRef(inventoryId).update(invUpdate);

  return ref.id;
}

/**
 * Actualiza un dispositivo.
 */
async function updateDevice(inventoryId, deviceId, data) {
  const oldDevice = await getDevice(inventoryId, deviceId);
  await getDeviceRef(inventoryId, deviceId).update({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Update inventory counters if status changed
  if (oldDevice.status !== data.status) {
    const invUpdate = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (oldDevice.status === 'Funcional' && data.status !== 'Funcional') {
      invUpdate.funcCount = firebase.firestore.FieldValue.increment(-1);
    } else if (oldDevice.status !== 'Funcional' && data.status === 'Funcional') {
      invUpdate.funcCount = firebase.firestore.FieldValue.increment(1);
    }
    await getInventoryRef(inventoryId).update(invUpdate);
  } else {
    await getInventoryRef(inventoryId).update({
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Elimina un dispositivo.
 */
async function deleteDevice(inventoryId, deviceId) {
  const device = await getDevice(inventoryId, deviceId);
  await getDeviceRef(inventoryId, deviceId).delete();

  const invUpdate = {
    deviceCount: firebase.firestore.FieldValue.increment(-1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (device.status === 'Funcional') {
    invUpdate.funcCount = firebase.firestore.FieldValue.increment(-1);
  }
  await getInventoryRef(inventoryId).update(invUpdate);
}


/**
 * Escucha cambios en tiempo real de los dispositivos de un inventario.
 */
function listenDevices(inventoryId, callback) {
  return getDevicesRef(inventoryId)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const devices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(devices);
    }, err => console.error('listenDevices:', err));
}

/**
 * Actualiza un dispositivo.
 */
async function updateDevice(inventoryId, deviceId, data) {
  await getDeviceRef(inventoryId, deviceId).update({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await getInventoryRef(inventoryId).update({
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Elimina un dispositivo.
 */
async function deleteDevice(inventoryId, deviceId) {
  await getDeviceRef(inventoryId, deviceId).delete();

  await getInventoryRef(inventoryId).update({
    deviceCount: firebase.firestore.FieldValue.increment(-1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Obtiene un dispositivo por ID.
 */
async function getDevice(inventoryId, deviceId) {
  const doc = await getDeviceRef(inventoryId, deviceId).get();
  if (!doc.exists) throw new Error('Dispositivo no encontrado');
  return { id: doc.id, ...doc.data() };
}

/**
 * Verifica si un serial (universitario o de fabricante) ya existe en el inventario.
 * Retorna el objeto del dispositivo duplicado si existe, o null.
 * MEJORA #2: Ejecuta ambas consultas en paralelo con Promise.all para mayor rendimiento.
 */
async function checkDuplicateSerial(inventoryId, univSerial, devSerial, excludeDeviceId = null) {
  if (!univSerial && !devSerial) return null;
  const devicesRef = getDevicesRef(inventoryId);

  // Run both queries in parallel to halve network wait time
  const queries = [];
  if (univSerial) {
    queries.push(
      devicesRef.where('universitySerial', '==', univSerial).get()
        .then(snap => ({ type: 'universitario', snap }))
    );
  }
  if (devSerial) {
    queries.push(
      devicesRef.where('deviceSerial', '==', devSerial).get()
        .then(snap => ({ type: 'fabricante', snap }))
    );
  }

  const results = await Promise.all(queries);
  for (const { type, snap } of results) {
    const dup = snap.docs.find(d => d.id !== excludeDeviceId);
    if (dup) return { type, data: dup.data() };
  }
  return null;
}

/**
 * Agrega múltiples dispositivos en lote (Batch).
 */
async function bulkAddDevices(inventoryId, devices, userId, email) {
  devices.forEach(validateDeviceData);

  const invRef = getInventoryRef(inventoryId);
  const devicesRef = getDevicesRef(inventoryId);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  // Dividir en bloques de 499 (máximo de batch de firestore)
  for (let i = 0; i < devices.length; i += 499) {
    const chunk = devices.slice(i, i + 499);
    const batch = db.batch();
    
    chunk.forEach(device => {
      const docRef = devicesRef.doc();
      batch.set(docRef, {
        ...device,
        createdBy: userId,
        createdByEmail: email,
        createdAt: now,
        updatedAt: now
      });
    });
    
    // Actualizar contador del inventario
    batch.update(invRef, {
        deviceCount: firebase.firestore.FieldValue.increment(chunk.length),
        updatedAt: now
    });
    
    await batch.commit();
  }
  
  await logUserAction('bulk_add_devices', { count: devices.length, inventoryId }, userId, email);
}

// ==========================================
// SYSTEM LOGS (ERRORES)
// ==========================================

/**
 * Guarda un error en la base de datos para revisión posterior.
 */
async function logSystemError(errorData) {
  try {
    await getLogsRef().add({
      ...errorData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    if (e.code !== 'permission-denied') {
      console.error("Fallo al guardar log en DB:", e);
    }
  }
}

/**
 * Escucha los logs del sistema en tiempo real.
 */
function listenSystemLogs(callback) {
  return getLogsRef()
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(logs);
    }, err => console.error('listenSystemLogs:', err));
}

/**
 * Recalcula los contadores de un inventario basado en sus dispositivos.
 */
async function recalculateStats(inventoryId) {
  const devicesSnap = await getDevicesRef(inventoryId).get();
  let deviceCount = 0;
  let funcCount = 0;
  
  devicesSnap.docs.forEach(doc => {
    const data = doc.data();
    deviceCount++;
    if (data.status === 'Funcional') funcCount++;
  });
  
  await getInventoryRef(inventoryId).update({
    deviceCount,
    funcCount,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
