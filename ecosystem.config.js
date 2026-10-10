// Optional: run the hub under PM2 (`pm2 start ecosystem.config.js && pm2 save`).
module.exports = {
  apps: [{
    name: "chasqui",
    script: "src/hub.js",
    cwd: __dirname,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
  }],
};
