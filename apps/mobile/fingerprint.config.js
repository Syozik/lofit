const SourceSkips = {
    ExpoConfigVersions: 1,
    ExpoConfigRuntimeVersionIfString: 2,
    PackageJsonAndroidAndIosScriptsIfNotContainRun: 512,
    PackageJsonScriptsAll: 1024,
    EasJson: 8192,
    Easignore: 16384,
    AutolinkingConfigPaths: 32768,
};

module.exports = {
    sourceSkips:
        SourceSkips.ExpoConfigVersions |
        SourceSkips.ExpoConfigRuntimeVersionIfString |
        SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun |
        SourceSkips.PackageJsonScriptsAll |
        SourceSkips.EasJson |
        SourceSkips.Easignore |
        SourceSkips.AutolinkingConfigPaths,
};
