/**
 * Analytics tracking para Reparaciones PC
 * Rastrea visitas de páginas y clics de WhatsApp automáticamente
 */

class Analytics {
    constructor() {
        this.baseUrl = window.location.origin;
        this.sessionId = this.generateSessionId();
        this.isTracking = true;
        
        // Verificar si el tracking está habilitado
        if (localStorage.getItem('analytics-disabled') === 'true') {
            this.isTracking = false;
            return;
        }
        
        this.init();
    }
    
    init() {
        // Trackear visita inicial
        this.trackPageVisit();
        
        // Trackear clics en botones de WhatsApp
        this.setupWhatsAppTracking();
        
        // Trackear navegación SPA (single page app)
        this.setupSPATracking();
        
        // Trackear tiempo en página
        this.setupTimeTracking();
        
        console.log('📊 Analytics inicializadas');
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async trackPageVisit(page = null) {
        if (!this.isTracking) return;
        
        try {
            const currentPage = page || window.location.pathname + window.location.hash;
            const referrer = document.referrer || null;
            const userAgent = navigator.userAgent;
            
            await fetch(`${this.baseUrl}/api/analytics/visit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    page: currentPage,
                    referrer: referrer,
                    userAgent: userAgent,
                    sessionId: this.sessionId,
                    timestamp: new Date().toISOString()
                })
            });
            
            console.log(`📈 Visita registrada: ${currentPage}`);
        } catch (error) {
            console.warn('Error tracking page visit:', error);
        }
    }
    
    async trackWhatsAppClick(equipmentType = 'unknown') {
        if (!this.isTracking) return;
        
        try {
            await fetch(`${this.baseUrl}/api/analytics/whatsapp-click`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    equipmentType: equipmentType,
                    sessionId: this.sessionId,
                    timestamp: new Date().toISOString()
                })
            });
            
            console.log(`💬 Click WhatsApp registrado: ${equipmentType}`);
        } catch (error) {
            console.warn('Error tracking WhatsApp click:', error);
        }
    }
    
    setupWhatsAppTracking() {
        // Trackear todos los enlaces de WhatsApp
        document.addEventListener('click', (event) => {
            const target = event.target.closest('a[href*="wa.me"], a[href*="whatsapp.com"]');
            if (target) {
                // Intentar extraer el tipo de equipo del contexto
                const equipmentType = this.extractEquipmentType(target);
                this.trackWhatsAppClick(equipmentType);
            }
        });
        
        // Trackear botones específicos de WhatsApp
        const whatsappButtons = document.querySelectorAll('[data-whatsapp-equipment]');
        whatsappButtons.forEach(button => {
            button.addEventListener('click', () => {
                const equipmentType = button.getAttribute('data-whatsapp-equipment');
                this.trackWhatsAppClick(equipmentType);
            });
        });
    }
    
    extractEquipmentType(element) {
        // Buscar data attribute
        if (element.dataset.equipment) {
            return element.dataset.equipment;
        }
        
        // Buscar en el texto del elemento
        const text = element.textContent.toLowerCase();
        if (text.includes('notebook') || text.includes('laptop')) return 'notebook';
        if (text.includes('pc') || text.includes('escritorio')) return 'pc';
        if (text.includes('netbook')) return 'netbook';
        if (text.includes('all in one')) return 'all-in-one';
        
        // Buscar en elementos padre/hermano
        const parent = element.closest('.service-card, .equipment-section, .contact-form');
        if (parent) {
            const parentText = parent.textContent.toLowerCase();
            if (parentText.includes('notebook')) return 'notebook';
            if (parentText.includes('pc')) return 'pc';
        }
        
        return 'unknown';
    }
    
    setupSPATracking() {
        // Trackear cambios de hash (navegación interna)
        let currentHash = window.location.hash;
        
        const trackHashChange = () => {
            const newHash = window.location.hash;
            if (newHash !== currentHash) {
                currentHash = newHash;
                this.trackPageVisit(window.location.pathname + newHash);
            }
        };
        
        window.addEventListener('hashchange', trackHashChange);
        
        // Trackear clics en enlaces internos
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href^="#"]');
            if (link && link.href !== window.location.href) {
                setTimeout(() => trackHashChange(), 100);
            }
        });
    }
    
    setupTimeTracking() {
        this.startTime = Date.now();
        this.isActive = true;
        
        // Detectar cuando la página se vuelve inactiva
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.isActive = false;
                this.trackTimeSpent();
            } else {
                this.isActive = true;
                this.startTime = Date.now();
            }
        });
        
        // Trackear tiempo antes de salir
        window.addEventListener('beforeunload', () => {
            this.trackTimeSpent();
        });
    }
    
    trackTimeSpent() {
        if (!this.isTracking || !this.startTime) return;
        
        const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
        
        // Solo trackear si estuvo al menos 10 segundos
        if (timeSpent >= 10) {
            navigator.sendBeacon(`${this.baseUrl}/api/analytics/time-spent`, JSON.stringify({
                page: window.location.pathname + window.location.hash,
                timeSpent: timeSpent,
                sessionId: this.sessionId
            }));
        }
    }
    
    // Método público para trackear eventos personalizados
    trackEvent(eventName, eventData = {}) {
        if (!this.isTracking) return;
        
        try {
            fetch(`${this.baseUrl}/api/analytics/event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event: eventName,
                    data: eventData,
                    sessionId: this.sessionId,
                    timestamp: new Date().toISOString()
                })
            });
            
            console.log(`📊 Evento registrado: ${eventName}`, eventData);
        } catch (error) {
            console.warn('Error tracking event:', error);
        }
    }
    
    // Método para deshabilitar tracking (GDPR compliance)
    disableTracking() {
        this.isTracking = false;
        localStorage.setItem('analytics-disabled', 'true');
        console.log('📊 Analytics deshabilitadas');
    }
    
    enableTracking() {
        this.isTracking = true;
        localStorage.removeItem('analytics-disabled');
        console.log('📊 Analytics habilitadas');
    }
}

// Inicializar analytics cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Solo inicializar si no estamos en el admin
    if (!window.location.pathname.includes('admin.html')) {
        window.analytics = new Analytics();
    }
});

// Exponer funciones globales para uso manual
window.trackWhatsAppClick = (equipmentType) => {
    if (window.analytics) {
        window.analytics.trackWhatsAppClick(equipmentType);
    }
};

window.trackEvent = (eventName, eventData) => {
    if (window.analytics) {
        window.analytics.trackEvent(eventName, eventData);
    }
};