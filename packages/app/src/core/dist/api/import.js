"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const core_utils_1 = require("@electron-forge/core-utils");
const template_base_1 = __importDefault(require("@electron-forge/template-base"));
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const listr2_1 = require("listr2");
const lodash_1 = require("lodash");
const install_dependencies_1 = __importStar(require("../util/install-dependencies"));
const read_package_json_1 = require("../util/read-package-json");
const upgrade_forge_config_1 = __importStar(require("../util/upgrade-forge-config"));
const init_git_1 = require("./init-scripts/init-git");
const init_npm_1 = require("./init-scripts/init-npm");
const d = (0, debug_1.default)('electron-forge:import');
exports.default = async ({ dir = process.cwd(), interactive = false, confirmImport, shouldContinueOnExisting, shouldRemoveDependency, shouldUpdateScript, outDir, }) => {
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
            title: 'Locating importable project',
            task: async () => {
                d(`Attempting to import project in: ${dir}`);
                if (!(await fs_extra_1.default.pathExists(dir)) || !(await fs_extra_1.default.pathExists(path_1.default.resolve(dir, 'package.json')))) {
                    throw new Error(`We couldn't find a project with a package.json file in: ${dir}`);
                }
                if (typeof confirmImport === 'function') {
                    if (!(await confirmImport())) {
                        // TODO: figure out if we can just return early here
                        // eslint-disable-next-line no-process-exit
                        process.exit(0);
                    }
                }
                await (0, init_git_1.initGit)(dir);
            },
        },
        {
            title: 'Processing configuration and dependencies',
            options: {
                persistentOutput: true,
                bottomBar: Infinity,
            },
            task: async (ctx, task) => {
                const calculatedOutDir = outDir || 'out';
                const importDeps = [].concat(init_npm_1.deps);
                let importDevDeps = [].concat(init_npm_1.devDeps);
                let importExactDevDeps = [].concat(init_npm_1.exactDevDeps);
                let packageJSON = await (0, read_package_json_1.readRawPackageJson)(dir);
                if (!packageJSON.version) {
                    task.output = chalk_1.default.yellow(`Please set the ${chalk_1.default.green('"version"')} in your application's package.json`);
                }
                if (packageJSON.config && packageJSON.config.forge) {
                    if (packageJSON.config.forge.makers) {
                        task.output = chalk_1.default.green('Existing Electron Forge configuration detected');
                        if (typeof shouldContinueOnExisting === 'function') {
                            if (!(await shouldContinueOnExisting())) {
                                // TODO: figure out if we can just return early here
                                // eslint-disable-next-line no-process-exit
                                process.exit(0);
                            }
                        }
                    }
                    else if (!(typeof packageJSON.config.forge === 'object')) {
                        task.output = chalk_1.default.yellow("We can't tell if the Electron Forge config is compatible because it's in an external JavaScript file, not trying to convert it and continuing anyway");
                    }
                    else {
                        d('Upgrading an Electron Forge < 6 project');
                        packageJSON.config.forge = (0, upgrade_forge_config_1.default)(packageJSON.config.forge);
                        importDevDeps = (0, upgrade_forge_config_1.updateUpgradedForgeDevDeps)(packageJSON, importDevDeps);
                    }
                }
                packageJSON.dependencies = packageJSON.dependencies || {};
                packageJSON.devDependencies = packageJSON.devDependencies || {};
                [importDevDeps, importExactDevDeps] = (0, core_utils_1.updateElectronDependency)(packageJSON, importDevDeps, importExactDevDeps);
                const keys = Object.keys(packageJSON.dependencies).concat(Object.keys(packageJSON.devDependencies));
                const buildToolPackages = {
                    '@electron/get': 'already uses this module as a transitive dependency',
                    '@electron/osx-sign': 'already uses this module as a transitive dependency',
                    'electron-builder': 'provides mostly equivalent functionality',
                    'electron-download': 'already uses this module as a transitive dependency',
                    'electron-forge': 'replaced with @electron-forge/cli',
                    'electron-installer-debian': 'already uses this module as a transitive dependency',
                    'electron-installer-dmg': 'already uses this module as a transitive dependency',
                    'electron-installer-flatpak': 'already uses this module as a transitive dependency',
                    'electron-installer-redhat': 'already uses this module as a transitive dependency',
                    'electron-packager': 'already uses this module as a transitive dependency',
                    'electron-winstaller': 'already uses this module as a transitive dependency',
                };
                for (const key of keys) {
                    if (buildToolPackages[key]) {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        const explanation = buildToolPackages[key];
                        let remove = true;
                        if (typeof shouldRemoveDependency === 'function') {
                            remove = await shouldRemoveDependency(key, explanation);
                        }
                        if (remove) {
                            delete packageJSON.dependencies[key];
                            delete packageJSON.devDependencies[key];
                        }
                    }
                }
                packageJSON.scripts = packageJSON.scripts || {};
                d('reading current scripts object:', packageJSON.scripts);
                const updatePackageScript = async (scriptName, newValue) => {
                    if (packageJSON.scripts[scriptName] !== newValue) {
                        let update = true;
                        if (typeof shouldUpdateScript === 'function') {
                            update = await shouldUpdateScript(scriptName, newValue);
                        }
                        if (update) {
                            packageJSON.scripts[scriptName] = newValue;
                        }
                    }
                };
                await updatePackageScript('start', 'electron-forge start');
                await updatePackageScript('package', 'electron-forge package');
                await updatePackageScript('make', 'electron-forge make');
                d('forgified scripts object:', packageJSON.scripts);
                const writeChanges = async () => {
                    await fs_extra_1.default.writeJson(path_1.default.resolve(dir, 'package.json'), packageJSON, { spaces: 2 });
                };
                return task.newListr([
                    {
                        title: 'Installing dependencies',
                        task: async (_, task) => {
                            const packageManager = (0, core_utils_1.safeYarnOrNpm)();
                            await writeChanges();
                            d('deleting old dependencies forcefully');
                            await fs_extra_1.default.remove(path_1.default.resolve(dir, 'node_modules/.bin/electron'));
                            await fs_extra_1.default.remove(path_1.default.resolve(dir, 'node_modules/.bin/electron.cmd'));
                            d('installing dependencies');
                            task.output = `${packageManager} install ${importDeps.join(' ')}`;
                            await (0, install_dependencies_1.default)(dir, importDeps);
                            d('installing devDependencies');
                            task.output = `${packageManager} install --dev ${importDevDeps.join(' ')}`;
                            await (0, install_dependencies_1.default)(dir, importDevDeps, install_dependencies_1.DepType.DEV);
                            d('installing exactDevDependencies');
                            task.output = `${packageManager} install --dev --exact ${importExactDevDeps.join(' ')}`;
                            await (0, install_dependencies_1.default)(dir, importExactDevDeps, install_dependencies_1.DepType.DEV, install_dependencies_1.DepVersionRestriction.EXACT);
                        },
                    },
                    {
                        title: 'Copying base template Forge configuration',
                        task: async () => {
                            var _a;
                            const pathToTemplateConfig = path_1.default.resolve(template_base_1.default.templateDir, 'forge.config.js');
                            // if there's an existing config.forge object in package.json
                            if (((_a = packageJSON === null || packageJSON === void 0 ? void 0 : packageJSON.config) === null || _a === void 0 ? void 0 : _a.forge) && typeof packageJSON.config.forge === 'object') {
                                d('detected existing Forge config in package.json, merging with base template Forge config');
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                const templateConfig = require(path_1.default.resolve(template_base_1.default.templateDir, 'forge.config.js'));
                                packageJSON = await (0, read_package_json_1.readRawPackageJson)(dir);
                                (0, lodash_1.merge)(templateConfig, packageJSON.config.forge); // mutates the templateConfig object
                                await writeChanges();
                                // otherwise, write to forge.config.js
                            }
                            else {
                                d('writing new forge.config.js');
                                await fs_extra_1.default.copyFile(pathToTemplateConfig, path_1.default.resolve(dir, 'forge.config.js'));
                            }
                        },
                    },
                    {
                        title: 'Fixing .gitignore',
                        task: async () => {
                            if (await fs_extra_1.default.pathExists(path_1.default.resolve(dir, '.gitignore'))) {
                                const gitignore = await fs_extra_1.default.readFile(path_1.default.resolve(dir, '.gitignore'));
                                if (!gitignore.includes(calculatedOutDir)) {
                                    await fs_extra_1.default.writeFile(path_1.default.resolve(dir, '.gitignore'), `${gitignore}\n${calculatedOutDir}/`);
                                }
                            }
                        },
                    },
                ], listrOptions);
            },
        },
        {
            title: 'Finalizing import',
            options: {
                persistentOutput: true,
                bottomBar: Infinity,
            },
            task: (_, task) => {
                task.output = `We have attempted to convert your app to be in a format that Electron Forge understands.
          
          Thanks for using ${chalk_1.default.green('Electron Forge')}!`;
            },
        },
    ], listrOptions);
    await runner.run();
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FwaS9pbXBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGdEQUF3QjtBQUV4QiwyREFBcUY7QUFDckYsa0ZBQXlEO0FBQ3pELGtEQUEwQjtBQUMxQixrREFBMEI7QUFDMUIsd0RBQTBCO0FBQzFCLG1DQUErQjtBQUMvQixtQ0FBK0I7QUFFL0IscUZBQThGO0FBQzlGLGlFQUErRDtBQUMvRCxxRkFBOEY7QUFFOUYsc0RBQWtEO0FBQ2xELHNEQUFzRTtBQUV0RSxNQUFNLENBQUMsR0FBRyxJQUFBLGVBQUssRUFBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBbUN6QyxrQkFBZSxLQUFLLEVBQUUsRUFDcEIsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFDbkIsV0FBVyxHQUFHLEtBQUssRUFDbkIsYUFBYSxFQUNiLHdCQUF3QixFQUN4QixzQkFBc0IsRUFDdEIsa0JBQWtCLEVBQ2xCLE1BQU0sR0FDUSxFQUFpQixFQUFFO0lBQ2pDLE1BQU0sWUFBWSxHQUFHO1FBQ25CLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLGVBQWUsRUFBRTtZQUNmLFFBQVEsRUFBRSxLQUFLO1lBQ2YsY0FBYyxFQUFFLEtBQUs7U0FDdEI7UUFDRCxjQUFjLEVBQUUsQ0FBQyxXQUFXO1FBQzVCLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztLQUM3QyxDQUFDO0lBRUYsTUFBTSxNQUFNLEdBQUcsSUFBSSxjQUFLLENBQ3RCO1FBQ0U7WUFDRSxLQUFLLEVBQUUsNkJBQTZCO1lBQ3BDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDZixDQUFDLENBQUMsb0NBQW9DLEdBQUcsRUFBRSxDQUFDLENBQUM7Z0JBQzdDLElBQUksQ0FBQyxDQUFDLE1BQU0sa0JBQUUsQ0FBQyxVQUFVLENBQUMsR0FB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