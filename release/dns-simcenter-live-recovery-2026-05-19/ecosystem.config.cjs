module.exports = {
  apps: [
    {
      name: "dns-simcenter",
      script: "./dist/index.cjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }
  ]
};
