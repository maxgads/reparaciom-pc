-- Seed data for PC Repair Service database
-- Test data for development and testing

-- Insert sample system stats
INSERT INTO system_stats (metric_name, metric_value, recorded_at) VALUES
('server_startup', 'successful', datetime('now', '-1 hour')),
('database_init', 'completed', datetime('now', '-1 hour')),
('ssl_cert_check', 'valid', datetime('now', '-30 minutes')),
('backup_status', 'completed', datetime('now', '-6 hours'));

-- Insert sample security log entries (for testing monitoring)
INSERT INTO security_logs (event_type, ip_address, user_agent, severity, details, created_at) VALUES
('contact_attempt', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'info', 'Legitimate contact form submission', datetime('now', '-2 hours')),
('contact_attempt', '10.0.0.50', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15', 'info', 'Mobile contact form submission', datetime('now', '-4 hours')),
('spam_detected', '203.0.113.45', 'curl/7.68.0', 'warning', 'Spam keywords detected in message', datetime('now', '-6 hours')),
('rate_limit_exceeded', '198.51.100.25', 'python-requests/2.25.1', 'error', 'More than 3 requests in 1 hour', datetime('now', '-8 hours'));

-- Insert sample legitimate contact (for testing email functionality)
INSERT INTO contacts (
    name, 
    email, 
    phone, 
    equipment_type, 
    problem_description, 
    ip_address, 
    user_agent, 
    recaptcha_score, 
    status, 
    created_at
) VALUES (
    'Juan Pérez',
    'juan.perez@email.com',
    '+5491123456789',
    'Notebook',
    'Mi notebook se apaga sola después de unos minutos de uso. Creo que puede ser un problema de temperatura.',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    0.9,
    'pending',
    datetime('now', '-2 hours')
);

-- Insert sample spam contact (for testing spam detection)
INSERT INTO contacts (
    name, 
    email, 
    phone, 
    equipment_type, 
    problem_description, 
    ip_address, 
    user_agent, 
    recaptcha_score, 
    status, 
    created_at
) VALUES (
    'Spam User',
    'spam@fakeemail.com',
    '1234567890',
    'PC',
    'OFERTA ESPECIAL!!! CLICK AQUI PARA GANAR DINERO FACIL!!!',
    '203.0.113.45',
    'curl/7.68.0',
    0.1,
    'spam',
    datetime('now', '-6 hours')
);

-- Initialize rate limits table with sample data
INSERT INTO rate_limits (ip_address, endpoint, request_count, window_start, last_request) VALUES
('192.168.1.100', '/api/contact', 1, datetime('now', '-30 minutes'), datetime('now', '-30 minutes')),
('10.0.0.50', '/api/contact', 2, datetime('now', '-45 minutes'), datetime('now', '-15 minutes'));

-- Insert sample blocked IP (for testing IP blocking)
INSERT INTO blocked_ips (
    ip_address, 
    reason, 
    blocked_until, 
    permanent, 
    blocked_count, 
    created_at
) VALUES (
    '198.51.100.25',
    'Excessive rate limiting violations and suspicious behavior',
    datetime('now', '+24 hours'),
    0,
    5,
    datetime('now', '-8 hours')
);