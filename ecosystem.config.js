module.exports = {
  apps: [{
    name: 'reparaciones-pc',
    script: './backend/server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    
    // Production environment
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    
    // Restart configuration
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    restart_delay: 4000,
    
    // Error handling
    min_uptime: '10s',
    max_restarts: 10,
    
    // Logs configuration
    log_file: './logs/pm2/combined.log',
    out_file: './logs/pm2/out.log',
    error_file: './logs/pm2/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Health check
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Cron restart (optional - restart every day at 3 AM)
    cron_restart: '0 3 * * *',
    
    // Additional settings
    ignore_watch: [
      'node_modules',
      'logs',
      'backups',
      '.git',
      'database'
    ],
    
    // Kill timeout
    kill_timeout: 1600,
    listen_timeout: 3000,
    
    // Source map support
    source_map_support: false,
    
    // Instance variables
    instance_var: 'INSTANCE_ID'
  }],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/master',
      repo: 'git@github.com:username/repo.git',
      path: '/var/www/production',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'ForwardAgent=yes'
    }
  }
};