module.exports = {
  "/api": {
    target:
      process.env["services__apiservice__https__0"] ||
      process.env["services__apiservice__http__0"],
    secure: process.env["NODE_ENV"] !== "development",
    pathRewrite: {
      "^/api": "",
    },
  },
  "/tileserver": {
    target:
      process.env["services__tileserver__https__0"] ||
      process.env["services__tileserver__http__0"],
    secure: process.env["NODE_ENV"] !== "development",
    pathRewrite: {
      "^/tileserver": "",
    },
  },
  "/keycloak": {
    target:
        process.env["services__keycloak__https__0"] ||
        process.env["services__keycloak__http__0"],
    secure: process.env["NODE_ENV"] !== "development",
    pathRewrite: {
      "^/keycloak": "",
    },
  },
};
