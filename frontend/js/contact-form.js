// PC Service Pro - Contact Form JavaScript

(function() {
    'use strict';

    // Form configuration
    const formConfig = {
        emailJsServiceId: 'YOUR_EMAILJS_SERVICE_ID',
        emailJsTemplateId: 'YOUR_EMAILJS_TEMPLATE_ID',
        emailJsUserId: 'YOUR_EMAILJS_USER_ID',
        recaptchaSiteKey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', // Test key
        maxSubmissionAttempts: 3,
        rateLimitWindow: 3600000 // 1 hour in milliseconds
    };

    // DOM Elements
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitSpinner = document.getElementById('submitSpinner');
    const submitIcon = document.getElementById('submitIcon');
    const submitText = document.getElementById('submitText');
    const successMessage = document.getElementById('successMessage');

    // Form fields
    const formFields = {
        fullName: document.getElementById('fullName'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        deviceType: document.getElementById('deviceType'),
        message: document.getElementById('message'),
        termsAccept: document.getElementById('termsAccept')
    };

    // Validation patterns
    const validationPatterns = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^(\+54|0)?[\s\-]?(\d{2,4})[\s\-]?\d{4}[\s\-]?\d{4}$/,
        name: /^[a-zA-ZÀ-ÿ\s]{2,50}$/
    };

    // Initialize contact form
    document.addEventListener('DOMContentLoaded', function() {
        initializeForm();
        initializeValidation();
        initializeEmailJS();
        checkRateLimit();
        
        console.log('Contact form initialized successfully');
    });

    // Form Initialization
    function initializeForm() {
        if (!contactForm) return;

        // Add form event listeners
        contactForm.addEventListener('submit', handleFormSubmission);
        
        // Add input event listeners for real-time validation
        Object.keys(formFields).forEach(fieldName => {
            const field = formFields[fieldName];
            if (field) {
                field.addEventListener('blur', () => validateField(fieldName));
                field.addEventListener('input', () => clearFieldError(fieldName));
            }
        });

        // Phone number formatting
        if (formFields.phone) {
            formFields.phone.addEventListener('input', formatPhoneNumber);
        }

        // Auto-resize textarea
        if (formFields.message) {
            formFields.message.addEventListener('input', autoResizeTextarea);
        }
    }

    // Form Submission Handler
    async function handleFormSubmission(e) {
        e.preventDefault();

        // Check rate limiting
        if (!checkSubmissionLimit()) {
            showError('Has alcanzado el límite de envíos. Inténtalo más tarde.');
            return;
        }

        // Validate form
        if (!validateForm()) {
            showError('Por favor corrige los errores en el formulario.');
            return;
        }

        // Verify reCAPTCHA
        const recaptchaResponse = getRecaptchaResponse();
        if (!recaptchaResponse) {
            showError('Por favor completa el reCAPTCHA.');
            return;
        }

        // Show loading state
        setSubmissionState('loading');

        try {
            // Submit form
            const success = await submitForm(recaptchaResponse);
            
            if (success) {
                handleSubmissionSuccess();
            } else {
                throw new Error('Error en el envío del formulario');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            handleSubmissionError(error);
        } finally {
            setSubmissionState('idle');
        }
    }

    // Form Validation
    function validateForm() {
        let isValid = true;

        // Validate each field
        Object.keys(formFields).forEach(fieldName => {
            if (!validateField(fieldName)) {
                isValid = false;
            }
        });

        return isValid;
    }

    function validateField(fieldName) {
        const field = formFields[fieldName];
        if (!field) return true;

        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        switch (fieldName) {
            case 'fullName':
                if (!value) {
                    isValid = false;
                    errorMessage = 'El nombre es obligatorio.';
                } else if (!validationPatterns.name.test(value)) {
                    isValid = false;
                    errorMessage = 'El nombre debe contener solo letras y espacios.';
                }
                break;

            case 'email':
                if (!value) {
                    isValid = false;
                    errorMessage = 'El email es obligatorio.';
                } else if (!validationPatterns.email.test(value)) {
                    isValid = false;
                    errorMessage = 'Ingresa un email válido.';
                }
                break;

            case 'phone':
                if (!value) {
                    isValid = false;
                    errorMessage = 'El teléfono es obligatorio.';
                } else if (!validationPatterns.phone.test(value)) {
                    isValid = false;
                    errorMessage = 'Ingresa un número de teléfono válido.';
                }
                break;

            case 'deviceType':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Selecciona el tipo de equipo.';
                }
                break;

            case 'message':
                if (!value) {
                    isValid = false;
                    errorMessage = 'La descripción del problema es obligatoria.';
                } else if (value.length < 10) {
                    isValid = false;
                    errorMessage = 'La descripción debe tener al menos 10 caracteres.';
                } else if (value.length > 1000) {
                    isValid = false;
                    errorMessage = 'La descripción no puede superar los 1000 caracteres.';
                }
                break;

            case 'termsAccept':
                if (!field.checked) {
                    isValid = false;
                    errorMessage = 'Debes aceptar los términos y condiciones.';
                }
                break;
        }

        // Show/hide validation feedback
        showFieldValidation(field, isValid, errorMessage);
        return isValid;
    }

    function showFieldValidation(field, isValid, errorMessage) {
        const fieldContainer = field.closest('.col-12') || field.closest('.col-md-6');
        const existingFeedback = fieldContainer.querySelector('.invalid-feedback');

        // Remove existing validation classes
        field.classList.remove('is-valid', 'is-invalid');

        if (isValid) {
            field.classList.add('is-valid');
            if (existingFeedback) {
                existingFeedback.style.display = 'none';
            }
        } else {
            field.classList.add('is-invalid');
            if (existingFeedback) {
                existingFeedback.textContent = errorMessage;
                existingFeedback.style.display = 'block';
            }
        }
    }

    function clearFieldError(fieldName) {
        const field = formFields[fieldName];
        if (field) {
            field.classList.remove('is-invalid');
            const fieldContainer = field.closest('.col-12') || field.closest('.col-md-6');
            const existingFeedback = fieldContainer.querySelector('.invalid-feedback');
            if (existingFeedback) {
                existingFeedback.style.display = 'none';
            }
        }
    }

    // Phone number formatting
    function formatPhoneNumber(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length >= 10) {
            if (value.startsWith('54')) {
                value = value.substring(2);
            }
            if (value.startsWith('9')) {
                value = value.substring(1);
            }
            
            // Format as XX-XXXX-XXXX
            if (value.length === 10) {
                value = value.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
            }
        }
        
        e.target.value = value;
    }

    // Auto-resize textarea
    function autoResizeTextarea(e) {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    }

    // reCAPTCHA Functions
    function initializeEmailJS() {
        // Initialize EmailJS if available
        if (typeof emailjs !== 'undefined') {
            emailjs.init(formConfig.emailJsUserId);
        }
    }

    function getRecaptchaResponse() {
        if (typeof grecaptcha !== 'undefined') {
            return grecaptcha.getResponse();
        }
        // For development, return a dummy response
        console.warn('reCAPTCHA not loaded - using dummy response for development');
        return 'development-mode';
    }

    function resetRecaptcha() {
        if (typeof grecaptcha !== 'undefined') {
            grecaptcha.reset();
        }
    }

    // Form Submission
    async function submitForm(recaptchaResponse) {
        const formData = collectFormData();
        
        // Add reCAPTCHA response
        formData.recaptchaResponse = recaptchaResponse;
        
        // Try EmailJS first
        if (typeof emailjs !== 'undefined') {
            return await submitWithEmailJS(formData);
        } else {
            // Fallback to local submission (for development)
            return await submitLocally(formData);
        }
    }

    function collectFormData() {
        return {
            fullName: formFields.fullName.value.trim(),
            email: formFields.email.value.trim(),
            phone: formFields.phone.value.trim(),
            deviceType: formFields.deviceType.value,
            message: formFields.message.value.trim(),
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            referrer: document.referrer || 'Direct'
        };
    }

    async function submitWithEmailJS(formData) {
        try {
            const response = await emailjs.send(
                formConfig.emailJsServiceId,
                formConfig.emailJsTemplateId,
                formData
            );
            
            return response.status === 200;
        } catch (error) {
            console.error('EmailJS error:', error);
            throw error;
        }
    }

    async function submitLocally(formData) {
        // Simulate form submission for development
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Form data (development mode):', formData);
                resolve(true);
            }, 2000);
        });
    }

    // Submission States
    function setSubmissionState(state) {
        switch (state) {
            case 'loading':
                submitBtn.disabled = true;
                submitBtn.classList.add('btn-loading');
                submitSpinner.style.display = 'inline-block';
                submitIcon.style.display = 'none';
                submitText.textContent = 'Enviando...';
                break;
            case 'success':
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-loading');
                submitBtn.classList.add('btn-success');
                submitSpinner.style.display = 'none';
                submitIcon.style.display = 'inline-block';
                submitIcon.className = 'bi bi-check-circle me-2';
                submitText.textContent = 'Enviado!';
                break;
            case 'error':
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-loading');
                submitBtn.classList.add('btn-danger');
                submitSpinner.style.display = 'none';
                submitIcon.style.display = 'inline-block';
                submitIcon.className = 'bi bi-exclamation-triangle me-2';
                submitText.textContent = 'Error - Reintentar';
                break;
            default: // idle
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-loading', 'btn-success', 'btn-danger');
                submitSpinner.style.display = 'none';
                submitIcon.style.display = 'inline-block';
                submitIcon.className = 'bi bi-send me-2';
                submitText.textContent = 'Enviar Consulta';
                break;
        }
    }

    // Success/Error Handlers
    function handleSubmissionSuccess() {
        setSubmissionState('success');
        
        // Show success message
        successMessage.style.display = 'block';
        successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Store submission timestamp for rate limiting
        storeSubmissionTimestamp();
        
        // Reset form after delay
        setTimeout(() => {
            resetForm();
            setSubmissionState('idle');
        }, 3000);
        
        // Generate WhatsApp link
        generateWhatsAppLink();
        
        // Send analytics event
        sendAnalyticsEvent('form_submit_success');
    }

    function handleSubmissionError(error) {
        setSubmissionState('error');
        showError('Error al enviar el formulario. Por favor inténtalo nuevamente.');
        resetRecaptcha();
        sendAnalyticsEvent('form_submit_error', error.message);
    }

    function showError(message) {
        // Create or update error alert
        let errorAlert = document.querySelector('.contact-error');
        if (!errorAlert) {
            errorAlert = document.createElement('div');
            errorAlert.className = 'contact-error alert alert-danger mt-3';
            contactForm.appendChild(errorAlert);
        }
        
        errorAlert.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${message}`;
        errorAlert.style.display = 'block';
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorAlert.style.display = 'none';
        }, 5000);
    }

    function resetForm() {
        contactForm.reset();
        
        // Clear validation classes
        Object.values(formFields).forEach(field => {
            if (field) {
                field.classList.remove('is-valid', 'is-invalid');
            }
        });
        
        // Hide messages
        successMessage.style.display = 'none';
        const errorAlert = document.querySelector('.contact-error');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
        
        // Reset reCAPTCHA
        resetRecaptcha();
    }

    // Rate Limiting
    function checkSubmissionLimit() {
        const submissions = getStoredSubmissions();
        const now = Date.now();
        const windowStart = now - formConfig.rateLimitWindow;
        
        // Filter submissions within the time window
        const recentSubmissions = submissions.filter(timestamp => timestamp > windowStart);
        
        return recentSubmissions.length < formConfig.maxSubmissionAttempts;
    }

    function checkRateLimit() {
        if (!checkSubmissionLimit()) {
            const timeRemaining = getRemainingCooldownTime();
            showRateLimitWarning(timeRemaining);
        }
    }

    function storeSubmissionTimestamp() {
        const submissions = getStoredSubmissions();
        submissions.push(Date.now());
        localStorage.setItem('pcservice_submissions', JSON.stringify(submissions));
    }

    function getStoredSubmissions() {
        try {
            const stored = localStorage.getItem('pcservice_submissions');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    function getRemainingCooldownTime() {
        const submissions = getStoredSubmissions();
        if (submissions.length === 0) return 0;
        
        const oldestRecentSubmission = Math.max(...submissions.slice(-formConfig.maxSubmissionAttempts));
        const cooldownEnd = oldestRecentSubmission + formConfig.rateLimitWindow;
        
        return Math.max(0, cooldownEnd - Date.now());
    }

    function showRateLimitWarning(timeRemaining) {
        const minutes = Math.ceil(timeRemaining / 60000);
        showError(`Has alcanzado el límite de envíos. Inténtalo nuevamente en ${minutes} minutos.`);
        
        // Disable form
        submitBtn.disabled = true;
        
        // Re-enable after cooldown
        setTimeout(() => {
            submitBtn.disabled = false;
        }, timeRemaining);
    }

    // WhatsApp Integration
    function generateWhatsAppLink() {
        const formData = collectFormData();
        const message = `Hola! Vi tu página web y necesito ayuda con mi ${formData.deviceType || 'equipo'}. 
        
Mi consulta: ${formData.message}
        
Datos de contacto:
- Nombre: ${formData.fullName}
- Email: ${formData.email}
- Teléfono: ${formData.phone}`;
        
        const whatsappUrl = `https://wa.me/5491112345678?text=${encodeURIComponent(message)}`;
        
        // Create WhatsApp button in success message
        const whatsappBtn = document.createElement('a');
        whatsappBtn.href = whatsappUrl;
        whatsappBtn.target = '_blank';
        whatsappBtn.className = 'btn btn-success mt-2';
        whatsappBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i>Continuar por WhatsApp';
        
        successMessage.querySelector('.alert').appendChild(whatsappBtn);
    }

    // Analytics
    function sendAnalyticsEvent(eventName, eventValue = null) {
        // Google Analytics 4
        if (typeof gtag !== 'undefined') {
            const eventData = {
                event_category: 'contact_form',
                event_label: window.location.pathname
            };
            
            if (eventValue) {
                eventData.value = eventValue;
            }
            
            gtag('event', eventName, eventData);
        }
        
        // Custom analytics
        if (typeof PCServiceProAnalytics !== 'undefined') {
            PCServiceProAnalytics.track(eventName, eventValue);
        }
    }

    // Accessibility Features
    function initializeValidation() {
        // Add ARIA attributes
        Object.keys(formFields).forEach(fieldName => {
            const field = formFields[fieldName];
            if (field) {
                field.setAttribute('aria-required', 'true');
                
                // Add describedby for error messages
                const fieldContainer = field.closest('.col-12') || field.closest('.col-md-6');
                const feedback = fieldContainer.querySelector('.invalid-feedback');
                if (feedback) {
                    const feedbackId = `${fieldName}-feedback`;
                    feedback.id = feedbackId;
                    field.setAttribute('aria-describedby', feedbackId);
                }
            }
        });
    }

    // Export functions for external use
    window.PCServiceProContact = {
        validateForm,
        resetForm,
        submitForm: handleFormSubmission
    };

})();

// Additional CSS for contact form enhancements
const contactFormStyles = `
<style>
.btn-loading {
    position: relative;
    pointer-events: none;
}

.form-control.is-valid,
.form-select.is-valid {
    border-color: #198754;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%23198754' d='m2.3 6.73.69-.04.76-.92V2.5h-.8V5.17l-.65.8-.8-1.04h-.83l.92 1.2z'/%3e%3c/svg%3e");
}

.form-control.is-invalid,
.form-select.is-invalid {
    border-color: #dc3545;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='%23dc3545'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath d='m5.8 4.6 0.8 0.8 0.8-0.8M6.6 7.4l-0.8-0.8-0.8 0.8'/%3e%3c/svg%3e");
}

.contact-success,
.contact-error {
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Form field focus animations */
.form-control:focus,
.form-select:focus {
    animation: focusIn 0.2s ease-out;
}

@keyframes focusIn {
    from {
        transform: scale(0.98);
    }
    to {
        transform: scale(1);
    }
}

/* Character counter for textarea */
.char-counter {
    font-size: 0.875rem;
    color: #6c757d;
    text-align: right;
    margin-top: 0.25rem;
}

.char-counter.warning {
    color: #fd7e14;
}

.char-counter.error {
    color: #dc3545;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', contactFormStyles);