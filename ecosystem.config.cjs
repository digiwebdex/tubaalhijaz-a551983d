// PM2 process file for Tuba Al Hijaz
// Runs API + dedicated queue worker. Never use `pm2 restart all` on this VPS.
module.exports = {
  apps: [
    {
      name: 'tubaalhijaz-api',
      script: 'server/index.js',
      cwd: '/var/www/tubaalhijaz',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4002,
      },
      out_file: '/var/www/tubaalhijaz/logs/api-out.log',
      error_file: '/var/www/tubaalhijaz/logs/api-error.log',
      time: true,
    },
    {
      name: 'tubaalhijaz-worker',
      script: 'server/worker.js',
      cwd: '/var/www/tubaalhijaz',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: '/var/www/tubaalhijaz/logs/worker-out.log',
      error_file: '/var/www/tubaalhijaz/logs/worker-error.log',
      time: true,
    },
  ],
};
