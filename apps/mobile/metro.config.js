const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const SINGLETONS = ["react", "react-native", "@tanstack/react-query"];
const appOrigin = path.join(__dirname, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
    const shared = SINGLETONS.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
    return context.resolveRequest(
        shared ? { ...context, originModulePath: appOrigin } : context,
        moduleName,
        platform,
    );
};

module.exports = config;
