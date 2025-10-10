#!/usr/bin/env node

/**
 * Script para generar secretos seguros para variables de entorno
 * Uso: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('='.repeat(60));
console.log('GENERADOR DE SECRETOS PARA RENDER');
console.log('='.repeat(60));
console.log('\nCopia estos valores en las variables de entorno de Render:\n');

console.log('JWT_SECRET:');
console.log(crypto.randomBytes(32).toString('hex'));
console.log('');

console.log('SESSION_SECRET:');
console.log(crypto.randomBytes(32).toString('hex'));
console.log('');

console.log('COOKIE_HASH_KEY:');
console.log(crypto.randomBytes(32).toString('hex'));
console.log('');

console.log('='.repeat(60));
console.log('⚠️  IMPORTANTE: Guarda estos valores en un lugar seguro');
console.log('   NO los subas a Git ni los compartas públicamente');
console.log('='.repeat(60));
