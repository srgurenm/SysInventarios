

/** Tipos de dispositivo disponibles en el sistema */
const DEVICE_TYPES = [
  'Computador de Escritorio',
  'Portátil/Laptop',
  'Pantalla/Monitor',
  'All-in-One',
  'Tablet',
  'Impresora',
  'Servidor',
  'Switch/Router',
  'Proyector',
  'Otro',
];

/** Iconos por tipo de dispositivo */
const TYPE_ICONS = {
  'Computador de Escritorio': '🖥️',
  'Portátil/Laptop':          '💻',
  'Pantalla/Monitor':         '🖵',
  'All-in-One':               '🖥️',
  'Tablet':                   '📱',
  'Impresora':                '🖨️',
  'Servidor':                 '🗄️',
  'Switch/Router':            '📡',
  'Proyector':                '📽️',
  'Otro':                     '📦',
};

/**
 * Puebla un elemento <select> con las opciones de DEVICE_TYPES.
 * @param {HTMLSelectElement} selectEl  - El elemento <select> a poblar.
 * @param {boolean} includeAll          - Si true, agrega "Todos los tipos" como primera opción vacía.
 * @param {boolean} includePlaceholder  - Si true, agrega "— Selecciona —" como primera opción vacía.
 */
function populateTypeSelect(selectEl, { includeAll = false, includePlaceholder = false } = {}) {
  if (!selectEl) return;
  selectEl.innerHTML = '';

  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Todos los tipos';
    selectEl.appendChild(opt);
  } else if (includePlaceholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— Selecciona —';
    selectEl.appendChild(opt);
  }

  DEVICE_TYPES.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    selectEl.appendChild(opt);
  });
}

/**
 * Especificaciones visibles por tipo de dispositivo
 */
const SPEC_FIELDS_BY_TYPE = {
  'Computador de Escritorio': ['proc', 'ram', 'storage', 'os', 'other'],
  'Portátil/Laptop':          ['proc', 'ram', 'storage', 'screen', 'os', 'other'],
  'Pantalla/Monitor':         ['screen', 'other'],
  'All-in-One':               ['proc', 'ram', 'storage', 'screen', 'os', 'other'],
  'Tablet':                   ['proc', 'ram', 'storage', 'screen', 'os', 'other'],
  'Impresora':                ['other'],
  'Servidor':                 ['proc', 'ram', 'storage', 'os', 'other'],
  'Switch/Router':            ['other'],
  'Proyector':                ['other'],
  'Otro':                     ['other']
};

/**
 * Muestra u oculta los contenedores de las especificaciones técnicas 
 * basándose en el tipo de dispositivo seleccionado.
 * @param {string} typeValue - El valor actual del select de tipo.
 * @param {string} prefix - Prefijo de los IDs de los inputs ('f-' para add, 'ed-' para edit).
 */
function updateSpecVisibility(typeValue, prefix = 'f-') {
  // Si no hay tipo seleccionado, mostramos todos por defecto
  const visibleFields = SPEC_FIELDS_BY_TYPE[typeValue] || ['proc', 'ram', 'storage', 'screen', 'os', 'other'];
  const allFields = ['proc', 'ram', 'storage', 'screen', 'os', 'other'];

  allFields.forEach(field => {
    const input = document.getElementById(`${prefix}${field}`);
    if (input) {
      const group = input.closest('.form-group');
      if (group) {
        if (visibleFields.includes(field)) {
          group.style.display = '';
        } else {
          group.style.display = 'none';
        }
      }
    }
  });
}
