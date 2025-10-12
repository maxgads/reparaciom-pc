-- Database schema for PC Repair Service - Supabase/PostgreSQL version
-- Migration from SQLite to PostgreSQL

-- Enable UUID extension (useful for generating unique IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create contacts table for storing contact form submissions
CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    equipment_type VARCHAR(100) NOT NULL,
    problem_description TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    recaptcha_score DECIMAL(3,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'resolved', 'spam')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create security_logs table for detailed security monitoring
CREATE TABLE IF NOT EXISTS security_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('contact_attempt', 'rate_limit_exceeded', 'spam_detected', 'suspicious_activity', 'validation_failed')),
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    request_data JSONB,
    blocked BOOLEAN DEFAULT FALSE,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create blocked_ips table for IP-based blocking
CREATE TABLE IF NOT EXISTS blocked_ips (
    id BIGSERIAL PRIMARY KEY,
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    blocked_until TIMESTAMP WITH TIME ZONE,
    permanent BOOLEAN DEFAULT FALSE,
    blocked_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create rate_limits table for tracking request rates
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_request TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ip_address, endpoint)
);

-- Create system_stats table for basic monitoring
CREATE TABLE IF NOT EXISTS system_stats (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value TEXT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create page_visits table for tracking website analytics
CREATE TABLE IF NOT EXISTS page_visits (
    id BIGSERIAL PRIMARY KEY,
    page_path VARCHAR(500) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create whatsapp_clicks table for tracking WhatsApp button clicks
CREATE TABLE IF NOT EXISTS whatsapp_clicks (
    id BIGSERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    equipment_type VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp for contacts
CREATE TRIGGER update_contacts_timestamp
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for blocked_ips
CREATE TRIGGER update_blocked_ips_timestamp
    BEFORE UPDATE ON blocked_ips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View for recent security events
CREATE OR REPLACE VIEW recent_security_events AS
SELECT
    event_type,
    ip_address,
    severity,
    COUNT(*) as event_count,
    MAX(created_at) as last_occurrence
FROM security_logs
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY event_type, ip_address, severity
ORDER BY last_occurrence DESC;

-- View for daily contact statistics
CREATE OR REPLACE VIEW daily_contact_stats AS
SELECT
    DATE(created_at) as contact_date,
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN status = 'spam' THEN 1 END) as spam_contacts,
    COUNT(CASE WHEN status != 'spam' THEN 1 END) as legitimate_contacts,
    AVG(recaptcha_score) as avg_recaptcha_score
FROM contacts
GROUP BY DATE(created_at)
ORDER BY contact_date DESC;

-- Enable Row Level Security (RLS) - Important for Supabase
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_clicks ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (backend will use service role key)
-- Note: You'll need to create more specific policies based on your security requirements

-- Contacts policies (backend can do everything)
CREATE POLICY "Service role can do everything on contacts" ON contacts
    FOR ALL USING (true) WITH CHECK (true);

-- Security logs policies
CREATE POLICY "Service role can do everything on security_logs" ON security_logs
    FOR ALL USING (true) WITH CHECK (true);

-- Blocked IPs policies
CREATE POLICY "Service role can do everything on blocked_ips" ON blocked_ips
    FOR ALL USING (true) WITH CHECK (true);

-- Rate limits policies
CREATE POLICY "Service role can do everything on rate_limits" ON rate_limits
    FOR ALL USING (true) WITH CHECK (true);

-- System stats policies
CREATE POLICY "Service role can do everything on system_stats" ON system_stats
    FOR ALL USING (true) WITH CHECK (true);

-- Page visits policies
CREATE POLICY "Service role can do everything on page_visits" ON page_visits
    FOR ALL USING (true) WITH CHECK (true);

-- WhatsApp clicks policies
CREATE POLICY "Service role can do everything on whatsapp_clicks" ON whatsapp_clicks
    FOR ALL USING (true) WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE contacts IS 'Stores contact form submissions from the website';
COMMENT ON TABLE security_logs IS 'Detailed security event monitoring and logging';
COMMENT ON TABLE blocked_ips IS 'IP addresses that are blocked from accessing the service';
COMMENT ON TABLE rate_limits IS 'Request rate tracking per IP and endpoint';
COMMENT ON TABLE system_stats IS 'System metrics and monitoring data';
COMMENT ON TABLE page_visits IS 'Website analytics and page view tracking';
COMMENT ON TABLE whatsapp_clicks IS 'Tracks WhatsApp contact button clicks';
