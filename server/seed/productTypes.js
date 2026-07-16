/**
 * Product types (device categories) — what kind of asset it is.
 * TV, Monitor, and Desktop (CPU/tower) are types; HP/Dell are brands.
 */
export const PRODUCT_TYPES = [
  { code: 'MON', name: 'Monitor', description: 'Computer display screen' },
  { code: 'TV', name: 'TV', description: 'Television / display panel' },
  { code: 'DESK', name: 'Desktop', description: 'Desktop PC / CPU tower unit' },
  { code: 'LAP', name: 'Laptop', description: 'Portable notebook computer' },
  { code: 'AIO', name: 'All-in-One', description: 'Integrated monitor and PC' },
  { code: 'PRT', name: 'Printer', description: 'Printer or multifunction device' },
  { code: 'SCN', name: 'Scanner', description: 'Document or image scanner' },
  { code: 'SRV', name: 'Server', description: 'Server hardware' },
  { code: 'TAB', name: 'Tablet', description: 'Tablet device' },
  { code: 'PHN', name: 'Phone', description: 'Mobile phone or smartphone' },
  { code: 'RTR', name: 'Router', description: 'Network router or switch' },
  { code: 'UPS', name: 'UPS', description: 'Uninterruptible power supply' },
  { code: 'PRJ', name: 'Projector', description: 'Presentation projector' },
  { code: 'KBD', name: 'Keyboard', description: 'Keyboard peripheral' },
  { code: 'MSE', name: 'Mouse', description: 'Mouse or pointing device' },
  { code: 'CAM', name: 'Webcam', description: 'Camera / webcam' },
  { code: 'STG', name: 'Storage', description: 'HDD, SSD, or external storage' },
  { code: 'RAM', name: 'RAM', description: 'Memory module' },
  { code: 'GPU', name: 'Graphics Card', description: 'Graphics processing unit' },
  { code: 'CPU', name: 'Processor', description: 'CPU chip / processor component' },
];
