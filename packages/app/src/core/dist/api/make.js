"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listrMake = void 0;
const path_1 = __importDefault(require("path"));
const core_utils_1 = require("@electron-forge/core-utils");
const maker_base_1 = require("@electron-forge/maker-base");
const get_1 = require("@electron/get");
const chalk_1 = __importDefault(require("chalk"));
const filenamify_1 = __importDefault(require("filenamify"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const listr2_1 = require("listr2");
const log_symbols_1 = __importDefault(require("log-symbols"));
const forge_config_1 = __importDefault(require("../util/forge-config"));
const hook_1 = require("../util/hook");
const out_dir_1 = __importDefault(require("../util/out-dir"));
const parse_archs_1 = __importDefault(require("../util/parse-archs"));
const read_package_json_1 = require("../util/read-package-json");
const require_search_1 = __importDefault(require("../util/require-search"));
const resolve_dir_1 = __importDefault(require("../util/resolve-dir"));
const package_1 = require("./package");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class MakerImpl extends maker_base_1.MakerBase {
    constructor() {
        super(...arguments);
        this.name = 'impl';
        this.defaultPlatforms = [];
    }
}
function generateTargets(forgeConfig, overrideTargets) {
    if (overrideTargets) {
        return overrideTargets.map((target) => {
            if (typeof target === 'string') {
                return forgeConfig.makers.find((maker) => maker.name === target) || { name: target };
            }
            return target;
        });
    }
    return forgeConfig.makers;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isElectronForgeMaker(target) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return target.__isElectronForgeMaker;
}
const listrMake = ({ dir: providedDir = process.cwd(), interactive = false, skipPackage = false, arch = (0, get_1.getHostArch)(), platform = process.platform, overrideTargets, outDir, }, receiveMakeResults) => {
    const listrOptions = {
        concurrent: false,
        rendererOptions: {
            collapse: false,
            collapseErrors: false,
        },
        rendererSilent: !interactive,
        rendererFallback: Boolean(process.env.DEBUG),
    };
    const runner = new listr2_1.Listr([
        {
            title: 'Loading configuration',
            task: async (ctx) => {
                const resolvedDir = await (0, resolve_dir_1.default)(providedDir);
                if (!resolvedDir) {
                    throw new Error('Failed to locate startable Electron application');
                }
                ctx.dir = resolvedDir;
                ctx.forgeConfig = await (0, forge_config_1.default)(resolvedDir);
            },
        },
        {
            title: 'Resolving make targets',
            task: async (ctx, task) => {
                const { dir, forgeConfig } = ctx;
                ctx.actualOutDir = outDir || (0, out_dir_1.default)(dir, forgeConfig);
                if (!['darwin', 'win32', 'linux', 'mas'].includes(platform)) {
                    throw new Error(`'${platform}' is an invalid platform. Choices are 'darwin', 'mas', 'win32' or 'linux'.`);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const makers = [];
                const possibleMakers = generateTargets(forgeConfig, overrideTargets);
                for (const possibleMaker of possibleMakers) {
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    let maker;
                    if (isElectronForgeMaker(possibleMaker)) {
                        maker = possibleMaker;
                        if (!maker.platforms.includes(platform))
                            continue;
                    }
                    else {
                        const resolvableTarget = possibleMaker;
                        // non-false falsy values should be 'true'
                        if (resolvableTarget.enabled === false)
                            continue;
                        if (!resolvableTarget.name) {
                            throw new Error(`The following maker config is missing a maker name: ${JSON.stringify(resolvableTarget)}`);
                        }
                        else if (typeof resolvableTarget.name !== 'string') {
                            throw new Error(`The following maker config has a maker name that is not a string: ${JSON.stringify(resolvableTarget)}`);
                        }
                        const MakerClass = (0, require_search_1.default)(dir, [resolvableTarget.name]);
                        if (!MakerClass) {
                            throw new Error(`Could not find module with name '${resolvableTarget.name}'. If this is a package from NPM, make sure it's listed in the devDependencies of your package.json. If this is a local module, make sure you have the correct path to its entry point. Try using the DEBUG="electron-forge:require-search" environment variable for more information.`);
                        }
                        maker = new MakerClass(resolvableTarget.config, resolvableTarget.platforms || undefined);
                        if (!maker.platforms.includes(platform))
                            continue;
                    }
                    if (!maker.isSupportedOnCurrentPlatform) {
                        throw new Error([
                            `Maker for target ${maker.name} is incompatible with this version of `,
                            'Electron Forge, please upgrade or contact the maintainer ',
                            "(needs to implement 'isSupportedOnCurrentPlatform)')",
                        ].join(''));
                    }
                    if (!maker.isSupportedOnCurrentPlatform()) {
                        throw new Error(`Cannot make for ${platform} and target ${maker.name}: the maker declared that it cannot run on ${process.platform}.`);
                    }
                    maker.ensureExternalBinariesExist();
                    makers.push(maker);
                }
                if (makers.length === 0) {
                    throw new Error(`Could not find any make targets configured for the "${platform}" platform.`);
                }
                ctx.makers = makers;
                task.output = `Making for the following targets: ${chalk_1.default.magenta(`${makers.map((maker) => maker.name).join(', ')}`)}`;
            },
            options: {
                persistentOutput: true,
            },
        },
        {
            title: `Running ${chalk_1.default.yellow('package')} command`,
            task: async (ctx, task) => {
                if (!skipPackage) {
                    return (0, package_1.listrPackage)({
                        dir: ctx.dir,
                        interactive,
                        arch,
                        outDir: ctx.actualOutDir,
                        platform,
                    });
                }
                else {
                    task.output = chalk_1.default.yellow(`${log_symbols_1.default.warning} Skipping could result in an out of date build`);
                    task.skip();
                }
            },
            options: {
                persistentOutput: true,
            },
        },
        {
            title: `Running ${chalk_1.default.yellow('preMake')} hook`,
            task: async (ctx, task) => {
                return task.newListr(await (0, hook_1.getHookListrTasks)(ctx.forgeConfig, 'preMake'));
            },
        },
        {
            title: 'Making distributables',
            task: async (ctx, task) => {
                const { actualOutDir, dir, forgeConfig, makers } = ctx;
                const packageJSON = await (0, read_package_json_1.readMutatedPackageJson)(dir, forgeConfig);
                const appName = (0, filenamify_1.default)(forgeConfig.packagerConfig.name || packageJSON.productName || packageJSON.name, { replacement: '-' });
                const outputs = [];
                ctx.outputs = outputs;
                const subRunner = task.newListr([], {
                    ...listrOptions,
                    rendererOptions: {
                        collapse: false,
                        collapseErrors: false,
                    },
                });
                for (const targetArch of (0, parse_archs_1.default)(platform, arch, await (0, core_utils_1.getElectronVersion)(dir, packageJSON))) {
                    const packageDir = path_1.default.resolve(actualOutDir, `${appName}-${platform}-${targetArch}`);
                    if (!(await fs_extra_1.default.pathExists(packageDir))) {
                        throw new Error(`Couldn't find packaged app at: ${packageDir}`);
                    }
                    for (const maker of makers) {
                        subRunner.add({
                            title: `Making a ${chalk_1.default.magenta(maker.name)} distributable for ${chalk_1.default.cyan(`${platform}/${targetArch}`)}`,
                            task: async () => {
                                try {
                                    /**
                                     * WARNING: DO NOT ATTEMPT TO PARALLELIZE MAKERS
                                     *
                                     * Currently it is assumed we have 1 maker per make call but that is
                                     * not enforced.  It is technically possible to have 1 maker be called
                                     * multiple times.  The "prepareConfig" method however implicitly
                                     * requires a lock that is not enforced.  There are two options:
                                     *
                                     *   * Provide makers a getConfig() method
                                     *   * Remove support for config being provided as a method
                                     *   * Change the entire API of maker from a single constructor to
                                     *     providing a MakerFactory
                                     */
                                    maker.prepareConfig(targetArch);
                                    const artifacts = await maker.make({
                                        appName,
                                        forgeConfig,
                                        packageJSON,
                                        targetArch,
                                        dir: packageDir,
                                        makeDir: path_1.default.resolve(actualOutDir, 'make'),
                                        targetPlatform: platform,
                                    });
                                    outputs.push({
                                        artifacts,
                                        packageJSON,
                                        platform,
                                        arch: targetArch,
                                    });
                                }
                                catch (err) {
                                    if (err) {
                                        throw err;
                                    }
                                    else {
                                        throw new Error(`An unknown error occurred while making for target: ${maker.name}`);
                                    }
                                }
                            },
                            options: {
                                showTimer: true,
                            },
                        });
                    }
                }
                return subRunner;
            },
        },
        {
            title: `Running ${chalk_1.default.yellow('postMake')} hook`,
            task: async (ctx, task) => {
                // If the postMake hooks modifies the locations / names of the outputs it must return
                // the new locations so that the publish step knows where to look
                ctx.outputs = await (0, hook_1.runMutatingHook)(ctx.forgeConfig, 'postMake', ctx.outputs);
                receiveMakeResults === null || receiveMakeResults === void 0 ? void 0 : receiveMakeResults(ctx.outputs);
                task.output = `Artifacts available at: ${chalk_1.default.green(path_1.default.resolve(ctx.actualOutDir, 'make'))}`;
            },
            options: {
                persistentOutput: true,
            },
        },
    ], {
        ...listrOptions,
        ctx: {},
    });
    return runner;
};
exports.listrMake = listrMake;
const make = async (opts) => {
    const runner = (0, exports.listrMake)(opts);
    await runner.run();
    return runner.ctx.outputs;
};
exports.default = make;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFrZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvbWFrZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxnREFBd0I7QUFFeEIsMkRBQWdFO0FBQ2hFLDJEQUF1RDtBQUV2RCx1Q0FBNEM7QUFDNUMsa0RBQTBCO0FBQzFCLDREQUFvQztBQUNwQyx3REFBMEI7QUFDMUIsbUNBQStCO0FBQy9CLDhEQUFxQztBQUVyQyx3RUFBa0Q7QUFDbEQsdUNBQWtFO0FBQ2xFLDhEQUErQztBQUMvQyxzRUFBNkM7QUFDN0MsaUVBQW1FO0FBQ25FLDRFQUFtRDtBQUNuRCxzRUFBNkM7QUFFN0MsdUNBQXlDO0FBRXpDLDhEQUE4RDtBQUM5RCxNQUFNLFNBQVUsU0FBUSxzQkFBYztJQUF0Qzs7UUFDRSxTQUFJLEdBQUcsTUFBTSxDQUFDO1FBRWQscUJBQWdCLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLENBQUM7Q0FBQTtBQUlELFNBQVMsZUFBZSxDQUFDLFdBQWdDLEVBQUUsZUFBNkI7SUFDdEYsSUFBSSxlQUFlLEVBQUU7UUFDbkIsT0FBTyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDcEMsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7Z0JBQzlCLE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFFLEtBQStCLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxJQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBNEIsQ0FBQzthQUM1STtZQUVELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFDRCxPQUFPLFdBQVcsQ0FBQyxNQUFNLENBQUM7QUFDNUIsQ0FBQztBQUVELDhEQUE4RDtBQUM5RCxTQUFTLG9CQUFvQixDQUFDLE1BQWdDO0lBQzVELDhEQUE4RDtJQUM5RCxPQUFRLE1BQXlCLENBQUMsc0JBQXNC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