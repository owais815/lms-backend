/**
 * PM2 process definitions.
 *
 * Replaces the bare `pm2 start app.js --name lms-backend` the deploy workflows
 * used, so both processes share one source of truth.
 *
 * kill_timeout is the important line: PM2's default is 1600ms, which SIGKILLs
 * mid-drain and makes the graceful shutdown handlers decorative.
 */
module.exports = {
  apps: [
    {
      name: 'lms-backend',
      script: 'app.js',
      exec_mode: 'fork',
      instances: 1,
      kill_timeout: 30000,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        DB_POOL_MAX: '15',
        EMAIL_WORKER_EMBEDDED: 'false',
      },
    },
    {
      name: 'lms-email-worker',
      script: 'worker.js',
      exec_mode: 'fork',
      // instances: 1 not because more is unsafe -- the claim-token lease
      // handles N workers correctly -- but because one worker at ~60 emails a
      // minute already saturates a normal SMTP quota.
      instances: 1,
      kill_timeout: 30000,
      max_memory_restart: '300M',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        DB_POOL_MAX: '6',
      },
    },
  ],
};
