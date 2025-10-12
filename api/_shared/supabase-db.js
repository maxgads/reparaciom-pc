const { createClient } = require('@supabase/supabase-js');
const { logger, SecurityLogger } = require('./logger');

require('dotenv').config();

class SupabaseDatabase {
    constructor() {
        this.supabase = null;
        this.isConnected = false;
    }

    async initialize() {
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!supabaseUrl || !supabaseKey) {
                throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
            }

            this.supabase = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });

            this.isConnected = true;
            SecurityLogger.logDatabaseConnection('success', { provider: 'Supabase' });
            logger.info('Supabase database initialized successfully');

            return true;
        } catch (error) {
            logger.error('Supabase database initialization failed', { error: error.message });
            SecurityLogger.logDatabaseConnection('failed', { error: error.message });
            throw error;
        }
    }

    async insertContact(contactData) {
        try {
            const { data, error } = await this.supabase
                .from('contacts')
                .insert([{
                    name: contactData.name,
                    email: contactData.email,
                    phone: contactData.phone,
                    equipment_type: contactData.equipment_type,
                    problem_description: contactData.problem_description,
                    ip_address: contactData.ip_address,
                    user_agent: contactData.user_agent,
                    recaptcha_score: contactData.recaptcha_score,
                    status: contactData.status || 'pending'
                }])
                .select();

            if (error) throw error;

            return { id: data[0].id, changes: 1 };
        } catch (error) {
            logger.error('Failed to insert contact', { error: error.message });
            throw error;
        }
    }

    async logSecurityEvent(eventData) {
        try {
            const { data, error } = await this.supabase
                .from('security_logs')
                .insert([{
                    event_type: eventData.event_type,
                    ip_address: eventData.ip_address,
                    user_agent: eventData.user_agent,
                    request_data: eventData.request_data || null,
                    blocked: eventData.blocked || false,
                    severity: eventData.severity || 'info',
                    details: eventData.details
                }])
                .select();

            if (error) throw error;

            return { id: data[0].id, changes: 1 };
        } catch (error) {
            logger.error('Failed to log security event', { error: error.message });
            throw error;
        }
    }

    async blockIP(ipAddress, reason, duration = null, permanent = false) {
        try {
            // First, check if IP already exists
            const { data: existingIP } = await this.supabase
                .from('blocked_ips')
                .select('blocked_count, created_at')
                .eq('ip_address', ipAddress)
                .single();

            const blocked_until = duration
                ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString()
                : null;

            const insertData = {
                ip_address: ipAddress,
                reason: reason,
                blocked_until: blocked_until,
                permanent: permanent,
                blocked_count: existingIP ? existingIP.blocked_count + 1 : 1,
                created_at: existingIP ? existingIP.created_at : new Date().toISOString()
            };

            const { error } = await this.supabase
                .from('blocked_ips')
                .upsert(insertData, { onConflict: 'ip_address' });

            if (error) throw error;

            SecurityLogger.logIPBlocked(ipAddress, reason, duration);
            return { changes: 1 };
        } catch (error) {
            logger.error('Failed to block IP', { error: error.message });
            throw error;
        }
    }

    async isIPBlocked(ipAddress) {
        try {
            const { data, error } = await this.supabase
                .from('blocked_ips')
                .select('*')
                .eq('ip_address', ipAddress)
                .or(`permanent.eq.true,blocked_until.gt.${new Date().toISOString()}`)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            return data || null;
        } catch (error) {
            logger.error('Failed to check if IP is blocked', { error: error.message });
            throw error;
        }
    }

    async updateRateLimit(ipAddress, endpoint) {
        try {
            const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000; // 1 hour
            const windowStartTime = new Date(Date.now() - windowMs).toISOString();

            // Check if there's an existing rate limit within the window
            const { data: existingLimit } = await this.supabase
                .from('rate_limits')
                .select('*')
                .eq('ip_address', ipAddress)
                .eq('endpoint', endpoint)
                .gt('window_start', windowStartTime)
                .single();

            if (existingLimit) {
                // Update existing limit
                const { error } = await this.supabase
                    .from('rate_limits')
                    .update({
                        request_count: existingLimit.request_count + 1,
                        last_request: new Date().toISOString()
                    })
                    .eq('ip_address', ipAddress)
                    .eq('endpoint', endpoint);

                if (error) throw error;
            } else {
                // Create new rate limit entry
                const { error } = await this.supabase
                    .from('rate_limits')
                    .upsert({
                        ip_address: ipAddress,
                        endpoint: endpoint,
                        request_count: 1,
                        window_start: new Date().toISOString(),
                        last_request: new Date().toISOString()
                    }, { onConflict: 'ip_address,endpoint' });

                if (error) throw error;
            }

            return { changes: 1 };
        } catch (error) {
            logger.error('Failed to update rate limit', { error: error.message });
            throw error;
        }
    }

    async getRateLimit(ipAddress, endpoint) {
        try {
            const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000;
            const windowStartTime = new Date(Date.now() - windowMs).toISOString();

            const { data, error } = await this.supabase
                .from('rate_limits')
                .select('*')
                .eq('ip_address', ipAddress)
                .eq('endpoint', endpoint)
                .gt('window_start', windowStartTime)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data || null;
        } catch (error) {
            logger.error('Failed to get rate limit', { error: error.message });
            throw error;
        }
    }

    async getRecentContacts(hours = 24) {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

            const { data, error } = await this.supabase
                .from('contacts')
                .select('*')
                .gt('created_at', startTime)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            logger.error('Failed to get recent contacts', { error: error.message });
            throw error;
        }
    }

    async getSecurityStats(hours = 24) {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

            const { data, error } = await this.supabase
                .from('security_logs')
                .select('event_type, severity, blocked')
                .gt('created_at', startTime);

            if (error) throw error;

            // Group by event_type and severity
            const stats = {};
            data.forEach(log => {
                const key = `${log.event_type}_${log.severity}`;
                if (!stats[key]) {
                    stats[key] = {
                        event_type: log.event_type,
                        severity: log.severity,
                        count: 0,
                        blocked_count: 0
                    };
                }
                stats[key].count++;
                if (log.blocked) {
                    stats[key].blocked_count++;
                }
            });

            return Object.values(stats).sort((a, b) => b.count - a.count);
        } catch (error) {
            logger.error('Failed to get security stats', { error: error.message });
            throw error;
        }
    }

    async cleanupOldRecords() {
        try {
            const retentionDays = process.env.DB_BACKUP_RETENTION_DAYS || 30;
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

            // Delete old security logs
            const { error: logsError } = await this.supabase
                .from('security_logs')
                .delete()
                .lt('created_at', cutoffDate);

            if (logsError) throw logsError;

            // Delete old rate limits (keep only 7 days)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { error: rateLimitsError } = await this.supabase
                .from('rate_limits')
                .delete()
                .lt('window_start', sevenDaysAgo);

            if (rateLimitsError) throw rateLimitsError;

            // Update expired blocked IPs
            const { error: blockedIPsError } = await this.supabase
                .from('blocked_ips')
                .update({ blocked_until: null })
                .lt('blocked_until', new Date().toISOString())
                .eq('permanent', false);

            if (blockedIPsError) throw blockedIPsError;

            logger.info('Database cleanup completed', { retentionDays });
        } catch (error) {
            logger.error('Database cleanup failed', { error: error.message });
            throw error;
        }
    }

    async healthCheck() {
        try {
            const { error } = await this.supabase
                .from('contacts')
                .select('id')
                .limit(1);

            if (error) throw error;

            return { healthy: true, status: 'connected' };
        } catch (error) {
            logger.error('Health check failed', { error: error.message });
            return { healthy: false, status: 'disconnected', error: error.message };
        }
    }

    async close() {
        // Supabase client doesn't need explicit closing
        // It manages connections automatically
        this.isConnected = false;
        logger.info('Supabase database connection closed');
    }
}

const database = new SupabaseDatabase();

module.exports = {
    SupabaseDatabase,
    database
};
