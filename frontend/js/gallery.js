// PC Service Pro - Gallery JavaScript

(function() {
    'use strict';

    // Gallery configuration
    const galleryConfig = {
        animationDuration: 300,
        filterTransition: 'all 0.3s ease',
        modalFadeSpeed: 200
    };

    // DOM Elements
    const galleryGrid = document.getElementById('gallery-grid');
    const filterButtons = document.querySelectorAll('.gallery-filters .btn');
    const galleryModal = document.getElementById('galleryModal');
    const modalImage = document.getElementById('modalImage');
    const galleryItems = document.querySelectorAll('.gallery-item');

    // Initialize gallery
    document.addEventListener('DOMContentLoaded', function() {
        initializeGalleryFilters();
        initializeGalleryModal();
        initializeGalleryInteractions();
        initializeImageOptimization();
        
        console.log('Gallery initialized successfully');
    });

    // Gallery Filter Functions
    function initializeGalleryFilters() {
        if (!filterButtons.length || !galleryItems.length) return;

        filterButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                const filter = this.getAttribute('data-filter');
                
                // Update active filter button
                updateActiveFilter(this);
                
                // Filter gallery items
                filterGalleryItems(filter);
                
                // Send analytics event
                sendFilterEvent(filter);
            });
        });
    }

    function updateActiveFilter(activeButton) {
        filterButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        activeButton.classList.add('active');
    }

    function filterGalleryItems(filter) {
        galleryItems.forEach((item, index) => {
            const category = item.getAttribute('data-category');
            const shouldShow = filter === 'all' || category === filter;
            
            // Add animation delay for stagger effect
            setTimeout(() => {
                if (shouldShow) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.classList.add('show');
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    item.classList.remove('show');
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, galleryConfig.animationDuration);
                }
            }, index * 50);
        });

        // Update gallery count
        updateGalleryCount(filter);
    }

    function updateGalleryCount(filter) {
        const visibleItems = filter === 'all' ? 
            galleryItems.length : 
            document.querySelectorAll(`.gallery-item[data-category="${filter}"]`).length;
        
        // Create or update count display
        let countElement = document.querySelector('.gallery-count');
        if (!countElement) {
            countElement = document.createElement('div');
            countElement.className = 'gallery-count text-muted text-center mt-3';
            galleryGrid.parentElement.appendChild(countElement);
        }
        
        countElement.textContent = `Mostrando ${visibleItems} trabajo${visibleItems !== 1 ? 's' : ''}`;
    }

    // Gallery Modal Functions
    function initializeGalleryModal() {
        if (!galleryModal || !modalImage) return;

        // Handle modal triggers
        const modalTriggers = document.querySelectorAll('[data-bs-toggle="modal"][data-bs-target="#galleryModal"]');
        
        modalTriggers.forEach(trigger => {
            trigger.addEventListener('click', function(e) {
                e.preventDefault();
                
                const imageSrc = this.getAttribute('data-image');
                const imageAlt = this.closest('.gallery-item').querySelector('img').alt || 'Imagen de galería';
                
                openGalleryModal(imageSrc, imageAlt);
            });
        });

        // Keyboard navigation in modal
        galleryModal.addEventListener('keydown', handleModalKeyboard);
        
        // Preload adjacent images when modal opens
        galleryModal.addEventListener('shown.bs.modal', preloadAdjacentImages);
    }

    function openGalleryModal(imageSrc, imageAlt) {
        if (!modalImage) return;

        // Show loading state
        modalImage.classList.add('loading');
        modalImage.src = '';
        modalImage.alt = imageAlt;

        // Load image
        const img = new Image();
        img.onload = function() {
            modalImage.src = imageSrc;
            modalImage.classList.remove('loading');
            modalImage.classList.add('loaded');
        };
        img.onerror = function() {
            modalImage.src = getPlaceholderImage();
            modalImage.alt = 'Imagen no disponible';
            modalImage.classList.remove('loading');
            modalImage.classList.add('error');
        };
        img.src = imageSrc;

        // Add navigation arrows if multiple images
        addModalNavigation(imageSrc);
    }

    function addModalNavigation(currentImageSrc) {
        const allImages = Array.from(document.querySelectorAll('[data-bs-toggle="modal"][data-image]'));
        const currentIndex = allImages.findIndex(trigger => 
            trigger.getAttribute('data-image') === currentImageSrc
        );

        if (allImages.length <= 1) return;

        // Remove existing navigation
        const existingNav = galleryModal.querySelectorAll('.modal-nav');
        existingNav.forEach(nav => nav.remove());

        // Add previous button
        if (currentIndex > 0) {
            const prevBtn = createNavButton('prev', () => {
                const prevImage = allImages[currentIndex - 1].getAttribute('data-image');
                const prevAlt = allImages[currentIndex - 1].closest('.gallery-item').querySelector('img').alt;
                openGalleryModal(prevImage, prevAlt);
            });
            galleryModal.querySelector('.modal-body').appendChild(prevBtn);
        }

        // Add next button
        if (currentIndex < allImages.length - 1) {
            const nextBtn = createNavButton('next', () => {
                const nextImage = allImages[currentIndex + 1].getAttribute('data-image');
                const nextAlt = allImages[currentIndex + 1].closest('.gallery-item').querySelector('img').alt;
                openGalleryModal(nextImage, nextAlt);
            });
            galleryModal.querySelector('.modal-body').appendChild(nextBtn);
        }

        // Add image counter
        const counter = document.createElement('div');
        counter.className = 'image-counter position-absolute text-white';
        counter.style.cssText = 'top: 10px; right: 50px; z-index: 10; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 15px; font-size: 0.875rem;';
        counter.textContent = `${currentIndex + 1} / ${allImages.length}`;
        galleryModal.querySelector('.modal-body').appendChild(counter);
    }

    function createNavButton(direction, clickHandler) {
        const button = document.createElement('button');
        button.className = `modal-nav modal-nav-${direction} btn btn-light position-absolute`;
        button.style.cssText = `
            ${direction === 'prev' ? 'left: 10px' : 'right: 10px'};
            top: 50%;
            transform: translateY(-50%);
            z-index: 10;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        button.innerHTML = direction === 'prev' ? 
            '<i class="bi bi-chevron-left"></i>' : 
            '<i class="bi bi-chevron-right"></i>';
        button.addEventListener('click', clickHandler);
        return button;
    }

    function handleModalKeyboard(e) {
        const currentImageSrc = modalImage.src;
        const allImages = Array.from(document.querySelectorAll('[data-bs-toggle="modal"][data-image]'));
        const currentIndex = allImages.findIndex(trigger => 
            trigger.getAttribute('data-image').includes(currentImageSrc.split('/').pop())
        );

        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (currentIndex > 0) {
                    const prevImage = allImages[currentIndex - 1].getAttribute('data-image');
                    const prevAlt = allImages[currentIndex - 1].closest('.gallery-item').querySelector('img').alt;
                    openGalleryModal(prevImage, prevAlt);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (currentIndex < allImages.length - 1) {
                    const nextImage = allImages[currentIndex + 1].getAttribute('data-image');
                    const nextAlt = allImages[currentIndex + 1].closest('.gallery-item').querySelector('img').alt;
                    openGalleryModal(nextImage, nextAlt);
                }
                break;
            case 'Escape':
                const modalInstance = bootstrap.Modal.getInstance(galleryModal);
                if (modalInstance) {
                    modalInstance.hide();
                }
                break;
        }
    }

    function preloadAdjacentImages() {
        const currentImageSrc = modalImage.src;
        const allImages = Array.from(document.querySelectorAll('[data-bs-toggle="modal"][data-image]'));
        const currentIndex = allImages.findIndex(trigger => 
            trigger.getAttribute('data-image').includes(currentImageSrc.split('/').pop())
        );

        // Preload previous and next images
        [-1, 1].forEach(offset => {
            const targetIndex = currentIndex + offset;
            if (targetIndex >= 0 && targetIndex < allImages.length) {
                const imageSrc = allImages[targetIndex].getAttribute('data-image');
                const img = new Image();
                img.src = imageSrc;
            }
        });
    }

    // Gallery Interactions
    function initializeGalleryInteractions() {
        // Add hover effects for gallery cards
        galleryItems.forEach(item => {
            const card = item.querySelector('.gallery-card');
            const overlay = item.querySelector('.gallery-overlay');
            
            if (card && overlay) {
                card.addEventListener('mouseenter', function() {
                    overlay.style.opacity = '1';
                });
                
                card.addEventListener('mouseleave', function() {
                    overlay.style.opacity = '0';
                });
            }
        });

        // Add click handlers for gallery items
        galleryItems.forEach(item => {
            const card = item.querySelector('.gallery-card');
            if (card) {
                card.addEventListener('click', function() {
                    const button = this.querySelector('[data-bs-toggle="modal"]');
                    if (button) {
                        button.click();
                    }
                });
            }
        });

        // Masonry-like layout adjustment
        adjustGalleryLayout();
        window.addEventListener('resize', PCServicePro.debounce(adjustGalleryLayout, 250));
    }

    function adjustGalleryLayout() {
        if (window.innerWidth >= 768) {
            // Simple masonry effect for larger screens
            const items = Array.from(galleryItems);
            const columnHeight = [0, 0, 0]; // For 3 columns
            
            items.forEach((item, index) => {
                if (item.style.display !== 'none') {
                    const shortestColumn = columnHeight.indexOf(Math.min(...columnHeight));
                    const yPos = columnHeight[shortestColumn];
                    
                    item.style.transform = `translateY(${yPos}px)`;
                    columnHeight[shortestColumn] += item.offsetHeight + 20; // 20px gap
                }
            });
        }
    }

    // Image Optimization
    function initializeImageOptimization() {
        // Lazy loading for gallery images
        const images = document.querySelectorAll('.gallery-item img');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.remove('lazy');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px'
            });

            images.forEach(img => {
                if (img.dataset.src) {
                    imageObserver.observe(img);
                }
            });
        }

        // Add loading states to images
        images.forEach(img => {
            img.addEventListener('load', function() {
                this.classList.add('loaded');
            });
            
            img.addEventListener('error', function() {
                this.src = getPlaceholderImage();
                this.alt = 'Imagen no disponible';
                this.classList.add('error');
            });
        });
    }

    // Utility Functions
    function getPlaceholderImage() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PGNpcmNsZSBjeD0iMjAwIiBjeT0iMTIwIiByPSI0MCIgZmlsbD0iI2RkZCIvPjxwYXRoIGQ9Im0xNjAgMTYwIDgwIDgwaDgwbC04MC04MHoiIGZpbGw9IiNkZGQiLz48dGV4dCB4PSI1MCUiIHk9IjgwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4=';
    }

    function sendFilterEvent(filter) {
        // Send analytics event if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'gallery_filter', {
                'filter_type': filter,
                'event_category': 'engagement',
                'event_label': 'gallery_interaction'
            });
        }
    }

    // Export gallery functions
    window.PCServiceProGallery = {
        filterGalleryItems,
        openGalleryModal,
        updateGalleryCount
    };

})();

// Additional CSS for gallery animations
const galleryStyles = `
<style>
.gallery-item {
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
}

.gallery-item.show {
    opacity: 1;
    transform: translateY(0);
}

.gallery-card img.loading {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
}

.gallery-card img.loaded {
    animation: fadeIn 0.5s ease-out;
}

.gallery-card img.error {
    filter: grayscale(100%);
}

.gallery-count {
    font-size: 0.875rem;
    margin-top: 1rem;
    animation: fadeIn 0.3s ease-out;
}

.modal-body img.loading::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.image-counter {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}

@keyframes spin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
}

@media (max-width: 767.98px) {
    .modal-nav {
        width: 35px;
        height: 35px;
        font-size: 0.875rem;
    }
    
    .modal-nav-prev {
        left: 5px;
    }
    
    .modal-nav-next {
        right: 5px;
    }
    
    .image-counter {
        top: 5px;
        right: 45px;
        font-size: 0.75rem;
        padding: 3px 8px;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', galleryStyles);