/**
 * db.js — Operaciones Firestore
 * CRUD para inventarios y dispositivos
 */

// ─── INVENTORIES ──────────────────────────────────────────

/**
 * Crea un nuevo inventario.
 * La contraseña se hashea con bcryptjs antes de guardar.
 */
async function createInventory(name, description, password, uid) {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const ref = await db.collection('inventories').add({
    name,
    description,
    passwordHash,
    createdBy:  uid,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    deviceCount: 0,
  });
  return ref.id;
}

/**
 * Lista todos los inventarios (para mostrar en el dashboard).
 * Retorna todos — el acceso de edición se controla por contraseña.
 */
function listenInventories(callback) {
  return db.collection('inventories')
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
  const doc = await db.collection('inventories').doc(id).get();
  if (!doc.exists) throw new Error('Inventario no encontrado');
  return { id: doc.id, ...doc.data() };
}

/**
 * Verifica la contraseña de un inventario.
 * Retorna true si coincide, false en caso contrario.
 */
async function verifyInventoryPassword(inventoryId, password) {
  const inv = await getInventory(inventoryId);
  return bcrypt.compareSync(password, inv.passwordHash);
}

/**
 * Actualiza metadatos de un inventario.
 */
async function updateInventory(id, data) {
  await db.collection('inventories').doc(id).update({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Elimina un inventario y todos sus dispositivos.
 * Usa batched writes para consistencia.
 */
async function deleteInventory(id) {
  const devicesSnap = await db.collection('inventories').doc(id).collection('devices').get();
  const batch = db.batch();
  devicesSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection('inventories').doc(id));
  await batch.commit();
}

// ─── DEVICES ──────────────────────────────────────────────

/**
 * Agrega un dispositivo a un inventario.
 */
async function addDevice(inventoryId, deviceData, uid) {
  const ref = await db
    .collection('inventories').doc(inventoryId)
    .collection('devices').add({
      ...deviceData,
      createdBy:  uid,
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    });

  // Update inventory counter
  await db.collection('inventories').doc(inventoryId).update({
    deviceCount: firebase.firestore.FieldValue.increment(1),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  });

  return ref.id;
}

/**
 * Escucha cambios en tiempo real de los dispositivos de un inventario.
 */
function listenDevices(inventoryId, callback) {
  return db.collection('inventories').doc(inventoryId)
    .collection('devices')
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
  await db.collection('inventories').doc(inventoryId)
    .collection('devices').doc(deviceId).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

  await db.collection('inventories').doc(inventoryId).update({
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Elimina un dispositivo.
 */
async function deleteDevice(inventoryId, deviceId) {
  await db.collection('inventories').doc(inventoryId)
    .collection('devices').doc(deviceId).delete();

  await db.collection('inventories').doc(inventoryId).update({
    deviceCount: firebase.firestore.FieldValue.increment(-1),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Obtiene un dispositivo por ID.
 */
async function getDevice(inventoryId, deviceId) {
  const doc = await db.collection('inventories').doc(inventoryId)
    .collection('devices').doc(deviceId).get();
  if (!doc.exists) throw new Error('Dispositivo no encontrado');
  return { id: doc.id, ...doc.data() };
}
