-- Database schema for PC Repair Service
-- SQLite database structure

-- Create contacts table for storing contact form submissions
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    recaptcha_score REAL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'resolved', 'spam')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create security_logs table for detailed security monitoring
CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK (event_type IN ('contact_attempt', 'rate_limit_exceeded', 'spam_detected', 'suspicious_activity', 'validation_failed')),
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    request_data TEXT,
    blocked BOOLEAN DEFAULT 0,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create blocked_ips table for IP-based blocking
CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    blocked_until DATETIME,
    permanent BOOLEAN DEFAULT 0,
    blocked_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create rate_limits table for tracking request rates
CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_request DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ip_address, endpoint)
);

-- Create system_stats table for basic monitoring
CREATE TABLE IF NOT EXISTS system_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create page_visits table for tracking website analytics
CREATE TABLE IF NOT EXISTS page_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_path TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    referrer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create whatsapp_clicks table for tracking WhatsApp button clicks
CREATE TABLE IF NOT EXISTS whatsapp_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    equipment_type TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_ip_address ON contacts(ip_address);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON page_visits(created_at);
CREATE INDEX IF NOT EXISTS idx_page_visits_page_path ON page_visits(page_path);
CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_created_at ON whatsapp_clicks(created_at);

-- Trigger to update updated_at timestamp for contacts
CREATE TRIGGER IF NOT EXISTS update_contacts_timestamp 
    AFTER UPDATE ON contacts
    FOR EACH ROW
    BEGIN
        UPDATE contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger to update updated_at timestamp for blocked_ips
CREATE TRIGGER IF NOT EXISTS update_blocked_ips_timestamp 
    AFTER UPDATE ON blocked_ips
    FOR EACH ROW
    BEGIN
        UPDATE blocked_ips SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- View for recent security events
CREATE VIEW IF NOT EXISTS recent_security_events AS
SELECT 
    event_type,
    ip_address,
    severity,
    COUNT(*) as event_count,
    MAX(created_at) as last_occurrence
FROM security_logs 
WHERE created_at >= datetime('now', '-24 hours')
GROUP BY event_type, ip_address, severity
ORDER BY last_occurrence DESC;

-- View for daily contact statistics
CREATE VIEW IF NOT EXISTS daily_contact_stats AS
SELECT 
    DATE(created_at) as contact_date,
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN status = 'spam' THEN 1 END) as spam_contacts,
    COUNT(CASE WHEN status != 'spam' THEN 1 END) as legitimate_contacts,
    AVG(recaptcha_score) as avg_recaptcha_score
FROM contacts 
GROUP BY DATE(created_at)
ORDER BY contact_date DESC;