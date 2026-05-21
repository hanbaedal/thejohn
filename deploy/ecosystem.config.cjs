/** 가비아 서버호스팅(Linux) SSH 배포 시: pm2 start deploy/ecosystem.config.cjs */
module.exports = {
    apps: [
        {
            name: "thejohn",
            cwd: require("path").join(__dirname, "..", "server"),
            script: "index.js",
            instances: 1,
            autorestart: true,
            max_memory_restart: "400M",
            env: {
                NODE_ENV: "production",
                PORT: "3000"
            }
        }
    ]
};
