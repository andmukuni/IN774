/**
 * cPanel / Phusion Passenger entry point.
 */
process.env.NODE_ENV = 'production';

import './server/index.js';
