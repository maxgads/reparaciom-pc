// Script para generar imágenes placeholder
// Ejecutar con: node generate-placeholders.js

const fs = require('fs');
const path = require('path');

const placeholders = [
    // Hero section
    {
        name: 'hero/pc-repair-hero.jpg',
        width: 600,
        height: 400,
        text: 'Técnico reparando PC'
    },
    
    // About section
    {
        name: 'about/technician-profile.jpg',
        width: 400,
        height: 400,
        text: 'Perfil del técnico'
    },
    
    // Gallery
    {
        name: 'gallery/cleaning-before-after-1.jpg',
        width: 400,
        height: 300,
        text: 'Limpieza PC'
    },
    {
        name: 'gallery/motherboard-repair.jpg',
        width: 400,
        height: 300,
        text: 'Reparación Motherboard'
    },
    {
        name: 'gallery/ram-upgrade.jpg',
        width: 400,
        height: 300,
        text: 'Upgrade RAM'
    },
    {
        name: 'gallery/laptop-cleaning.jpg',
        width: 400,
        height: 300,
        text: 'Limpieza Laptop'
    },
    {
        name: 'gallery/power-supply-repair.jpg',
        width: 400,
        height: 300,
        text: 'Reparación Fuente'
    },
    {
        name: 'gallery/ssd-installation.jpg',
        width: 400,
        height: 300,
        text: 'Instalación SSD'
    },
    
    // Testimonials
    {
        name: 'testimonials/client-1.jpg',
        width: 100,
        height: 100,
        text: 'Cliente 1'
    },
    {
        name: 'testimonials/client-2.jpg',
        width: 100,
        height: 100,
        text: 'Cliente 2'
    }
];

function createSVGPlaceholder(width, height, text) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#e9ecef"/>
  <text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 20}" fill="#6c757d" dominant-baseline="middle">
    ${text}
  </text>
  <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 30}" fill="#adb5bd" dominant-baseline="middle">
    ${width} x ${height}
  </text>
</svg>`;
}

// Crear directorios si no existen
placeholders.forEach(placeholder => {
    const fullPath = path.join(__dirname, 'images', placeholder.name);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const svgContent = createSVGPlaceholder(placeholder.width, placeholder.height, placeholder.text);
    const svgPath = fullPath.replace('.jpg', '.svg');
    
    fs.writeFileSync(svgPath, svgContent);
    console.log(`Created placeholder: ${svgPath}`);
});

console.log('All placeholders created successfully!');
console.log('\nPara generar imágenes reales con AI, usa estos prompts:');
console.log('===================================================');

const prompts = [
    {
        file: 'hero/pc-repair-hero.jpg',
        prompt: 'Joven técnico de 22-24 años, estudiante universitario, trabajando en reparación de PC, ambiente profesional pero juvenil, herramientas de trabajo visibles, componentes de computadora, La Plata Argentina, iluminación natural, realista, alta calidad'
    },
    {
        file: 'about/technician-profile.jpg',
        prompt: 'Retrato profesional de joven técnico argentino, 22-24 años, estudiante de ingeniería, sonrisa confiada, camisa casual pero prolija, fondo neutro, estilo LinkedIn, realista'
    },
    {
        file: 'gallery/cleaning-before-after-1.jpg',
        prompt: 'Antes y después limpieza PC gaming, polvo visible vs limpio, pasta térmica aplicada'
    },
    {
        file: 'gallery/motherboard-repair.jpg',
        prompt: 'Reparación motherboard, herramientas precision, componentes electrónicos'
    },
    {
        file: 'gallery/ram-upgrade.jpg',
        prompt: 'Instalación memoria RAM, manos técnico, módulos DDR4'
    },
    {
        file: 'gallery/laptop-cleaning.jpg',
        prompt: 'Limpieza notebook abierta, ventilador sin polvo, herramientas'
    },
    {
        file: 'gallery/power-supply-repair.jpg',
        prompt: 'Fuente de poder abierta, mantenimiento, cables ordenados'
    },
    {
        file: 'gallery/ssd-installation.jpg',
        prompt: 'Instalación SSD, disco M.2, destornillador, precisión'
    },
    {
        file: 'testimonials/client-1.jpg',
        prompt: 'Joven estudiante universitario argentino sonriendo, casual, realista'
    },
    {
        file: 'testimonials/client-2.jpg',
        prompt: 'Mujer joven profesional argentina, 25-30 años, sonrisa natural'
    }
];

prompts.forEach(item => {
    console.log(`\n${item.file}:`);
    console.log(`"${item.prompt}"`);
    console.log('---');
});