// PC Service Pro - Main JavaScript File

(function() {
    'use strict';

    // DOM Elements
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');
    const heroSection = document.querySelector('.hero-section');
    const scrollToTopBtn = document.getElementById('scrollToTop');

    // Initialize application
    document.addEventListener('DOMContentLoaded', function() {
        initializeNavigation();
        initializeScrollEffects();
        initializeAnimations();
        initializePerformanceOptimizations();
        
        console.log('PC Service Pro - Website initialized successfully');
    });

    // Navigation Functions
    function initializeNavigation() {
        // Smooth scrolling for navigation links
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    const navbarHeight = navbar.offsetHeight;
                    const targetPosition = targetSection.offsetTop - navbarHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    
                    // Close mobile menu if open
                    const navbarCollapse = document.querySelector('.navbar-collapse');
                    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                        const navbarToggler = document.querySelector('.navbar-toggler');
                        if (navbarToggler) {
                            navbarToggler.click();
                        }
                    }
                }
            });
        });

        // Update active nav link on scroll
        window.addEventListener('scroll', updateActiveNavLink);
        
        // Navbar background on scroll
        window.addEventListener('scroll', updateNavbarBackground);
    }

    function updateActiveNavLink() {
        const current = getCurrentSection();
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    }

    function getCurrentSection() {
        const scrollPosition = window.scrollY + navbar.offsetHeight + 100;
        
        for (let i = sections.length - 1; i >= 0; i--) {
            const section = sections[i];
            if (section.offsetTop <= scrollPosition) {
                return section.id;
            }
        }
        
        return 'home';
    }

    function updateNavbarBackground() {
        if (window.scrollY > 50) {
            navbar.classList.add('navbar-scrolled');
            navbar.style.backgroundColor = 'rgba(13, 110, 253, 0.95)';
        } else {
            navbar.classList.remove('navbar-scrolled');
            navbar.style.backgroundColor = '';
        }
    }

    // Scroll Effects
    function initializeScrollEffects() {
        // Parallax effect for hero section
        if (heroSection) {
            window.addEventListener('scroll', function() {
                const scrolled = window.pageYOffset;
                const parallaxSpeed = scrolled * 0.3;
                
                if (scrolled < heroSection.offsetHeight) {
                    heroSection.style.transform = `translateY(${parallaxSpeed}px)`;
                }
            });
        }

        // Scroll to top functionality
        createScrollToTopButton();
    }

    function createScrollToTopButton() {
        // Create scroll to top button if it doesn't exist
        if (!document.getElementById('scrollToTop')) {
            const scrollBtn = document.createElement('button');
            scrollBtn.id = 'scrollToTop';
            scrollBtn.className = 'scroll-to-top-btn';
            scrollBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
            scrollBtn.setAttribute('aria-label', 'Scroll to top');
            document.body.appendChild(scrollBtn);
        }

        const scrollBtn = document.getElementById('scrollToTop');

        // Show/hide scroll to top button
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                scrollBtn.classList.add('show');
            } else {
                scrollBtn.classList.remove('show');
            }
        });

        // Scroll to top functionality
        scrollBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Animations and Interactions
    function initializeAnimations() {
        // Intersection Observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    
                    // Add stagger animation for service cards
                    if (entry.target.classList.contains('service-card')) {
                        const index = Array.from(entry.target.parentElement.children).indexOf(entry.target);
                        entry.target.style.animationDelay = `${index * 0.1}s`;
                    }
                }
            });
        }, observerOptions);

        // Observe elements for animations
        const animateElements = document.querySelectorAll(
            '.service-card, .testimonial-card, .gallery-item, .contact-info-item, .about-content'
        );
        
        animateElements.forEach(el => observer.observe(el));

        // Counter animation for stats
        animateCounters();

        // Typing effect for hero title (optional)
        // initializeTypingEffect();
    }

    function animateCounters() {
        const counters = document.querySelectorAll('.hero-stats h3');
        
        const counterObserver = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.animated) {
                    animateCounter(entry.target);
                    entry.target.dataset.animated = 'true';
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => {
            counterObserver.observe(counter);
        });
    }

    function animateCounter(element) {
        const target = parseInt(element.textContent);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            if (current < target) {
                current += step;
                element.textContent = Math.floor(current) + (element.textContent.includes('+') ? '+' : '') + 
                                   (element.textContent.includes('%') ? '%' : '');
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target + (element.textContent.includes('+') ? '+' : '') + 
                                   (element.textContent.includes('%') ? '%' : '');
            }
        };

        updateCounter();
    }

    // Performance Optimizations
    function initializePerformanceOptimizations() {
        // Lazy loading for images
        initializeLazyLoading();
        
        // Preload critical resources
        preloadCriticalResources();
        
        // Add loading states
        addLoadingStates();
    }

    function initializeLazyLoading() {
        if ('IntersectionObserver' in window) {
            const images = document.querySelectorAll('img[data-src]');
            const imageObserver = new IntersectionObserver(function(entries) {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });

            images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for browsers without IntersectionObserver
            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => {
                img.src = img.dataset.src;
                img.classList.remove('lazy');
            });
        }
    }

    function preloadCriticalResources() {
        const criticalImages = [
            'images/hero/pc-repair-hero.jpg',
            'images/services/cleaning-service.jpg',
            'images/about/technician-profile.jpg'
        ];

        criticalImages.forEach(imageSrc => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = imageSrc;
            document.head.appendChild(link);
        });
    }

    function addLoadingStates() {
        // Add loading class to images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.complete) {
                img.classList.add('loading');
                img.addEventListener('load', function() {
                    this.classList.remove('loading');
                    this.classList.add('loaded');
                });
                img.addEventListener('error', function() {
                    this.classList.remove('loading');
                    this.classList.add('error');
                    // Set placeholder image
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbiBubyBkaXNwb25pYmxlPC90ZXh0Pjwvc3ZnPg==';
                });
            }
        });
    }

    // Utility Functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Accessibility Enhancements
    function initializeAccessibility() {
        // Skip to content link
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-link sr-only';
        skipLink.textContent = 'Saltar al contenido principal';
        document.body.insertBefore(skipLink, document.body.firstChild);

        // Keyboard navigation for gallery
        const galleryItems = document.querySelectorAll('.gallery-card');
        galleryItems.forEach(item => {
            item.tabIndex = 0;
            item.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const button = this.querySelector('[data-bs-toggle="modal"]');
                    if (button) {
                        button.click();
                    }
                }
            });
        });

        // Announce page changes to screen readers
        const pageTitle = document.title;
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = `Página cargada: ${pageTitle}`;
        document.body.appendChild(announcement);
    }

    // Error Handling
    window.addEventListener('error', function(e) {
        console.error('JavaScript Error:', e.error);
        
        // Send error to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'exception', {
                description: e.error.toString(),
                fatal: false
            });
        }
    });

    // Initialize accessibility features
    initializeAccessibility();

    // Export utilities for other scripts
    window.PCServicePro = {
        debounce,
        throttle,
        animateCounter,
        updateActiveNavLink
    };

})();

// Additional CSS for animations (injected via JavaScript)
const animationStyles = `
<style>
.scroll-to-top-btn {
    position: fixed;
    bottom: 30px;
    left: 30px;
    z-index: 999;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.3s ease;
    opacity: 0;
    visibility: hidden;
    transform: translateY(20px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.scroll-to-top-btn.show {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.scroll-to-top-btn:hover {
    background: var(--warning-color);
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.animate-in {
    animation: fadeInUp 0.8s ease-out forwards;
}

.loading {
    background: #f0f0f0;
    animation: pulse 1.5s ease-in-out infinite alternate;
}

.loaded {
    animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes pulse {
    from { opacity: 1; }
    to { opacity: 0.5; }
}

.skip-link:focus {
    position: absolute;
    left: 6px;
    top: 7px;
    z-index: 999999;
    padding: 8px 16px;
    background: #000;
    color: #fff;
    text-decoration: none;
    border-radius: 3px;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', animationStyles);