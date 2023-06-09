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
const debug_1 = __importDefault(require("debug"));
const listr2_1 = require("listr2");
const semver_1 = __importDefault(require("semver"));
const install_dependencies_1 = __importStar(require("../util/install-dependencies"));
const read_package_json_1 = require("../util/read-package-json");
const find_template_1 = require("./init-scripts/find-template");
const init_directory_1 = require("./init-scripts/init-directory");
const init_git_1 = require("./init-scripts/init-git");
const init_npm_1 = require("./init-scripts/init-npm");
const d = (0, debug_1.default)('electron-forge:init');
async function validateTemplate(template, templateModule) {
    if (!templateModule.requiredForgeVersion) {
        throw new Error(`Cannot use a template (${template}) with this version of Electron Forge, as it does not specify its required Forge version.`);
    }
    const forgeVersion = (await (0, read_package_json_1.readRawPackageJson)(path_1.default.join(__dirname, '..', '..'))).version;
    if (!semver_1.default.satisfies(forgeVersion, templateModule.requiredForgeVersion)) {
        throw new Error(`Template (${template}) is not compatible with this version of Electron Forge (${forgeVersion}), it requires ${templateModule.requiredForgeVersion}`);
    }
}
exports.default = async ({ dir = process.cwd(), interactive = false, copyCIFiles = false, force = false, template = 'base' }) => {
    d(`Initializing in: ${dir}`);
    const packageManager = (0, core_utils_1.safeYarnOrNpm)();
    const runner = new listr2_1.Listr([
        {
            title: `Locating custom template: "${template}"`,
            task: async (ctx) => {
                ctx.templateModule = await (0, find_template_1.findTemplate)(dir, template);
            },
        },
        {
            title: 'Initializing directory',
            task: async (_, task) => {
                await (0, init_directory_1.initDirectory)(dir, task, force);
                await (0, init_git_1.initGit)(dir);
            },
            options: {
                persistentOutput: true,
            },
        },
        {
            title: 'Preparing template',
            task: async ({ templateModule }) => {
                await validateTemplate(template, templateModule);
            },
        },
        {
            title: 'Initializing template',
            task: async ({ templateModule }, task) => {
                if (typeof templateModule.initializeTemplate === 'function') {
                    const tasks = await templateModule.initializeTemplate(dir, { copyCIFiles });
                    if (tasks) {
                        return task.newListr(tasks, { concurrent: false });
                    }
                }
            },
        },
        {
            title: 'Installing template dependencies',
            task: async ({ templateModule }, task) => {
                return task.newListr([
                    {
                        title: 'Installing production dependencies',
                        task: async (_, task) => {
                            var _a;
                            d('installing dependencies');
                            if ((_a = templateModule.dependencies) === null || _a === void 0 ? void 0 : _a.length) {
                                task.output = `${packageManager} install ${templateModule.dependencies.join(' ')}`;
                            }
                            return await (0, install_dependencies_1.default)(dir, templateModule.dependencies || [], install_dependencies_1.DepType.PROD, install_dependencies_1.DepVersionRestriction.RANGE);
                        },
                    },
                    {
                        title: 'Installing development dependencies',
                        task: async (_, task) => {
                            var _a;
                            d('installing devDependencies');
                            if ((_a = templateModule.devDependencies) === null || _a === void 0 ? void 0 : _a.length) {
                                task.output = `${packageManager} install --dev ${templateModule.devDependencies.join(' ')}`;
                            }
                            await (0, install_dependencies_1.default)(dir, templateModule.devDependencies || [], install_dependencies_1.DepType.DEV);
                        },
                    },
                    {
                        title: 'Finalizing dependencies',
                        task: async (_, task) => {
                            await (0, init_npm_1.initNPM)(dir, task);
                        },
                    },
                ], {
                    concurrent: false,
                    exitOnError: false,
                });
            },
        },
    ], {
        concurrent: false,
        rendererSilent: !interactive,
        rendererFallback: Boolean(process.env.DEBUG),
    });
    await runner.run();
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5pdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvaW5pdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0RBQXdCO0FBRXhCLDJEQUEyRDtBQUUzRCxrREFBMEI7QUFDMUIsbUNBQStCO0FBQy9CLG9EQUE0QjtBQUU1QixxRkFBOEY7QUFDOUYsaUVBQStEO0FBRS9ELGdFQUE0RDtBQUM1RCxrRUFBOEQ7QUFDOUQsc0RBQWtEO0FBQ2xELHNEQUFrRDtBQUVsRCxNQUFNLENBQUMsR0FBRyxJQUFBLGVBQUssRUFBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBeUJ2QyxLQUFLLFVBQVUsZ0JBQWdCLENBQUMsUUFBZ0IsRUFBRSxjQUE2QjtJQUM3RSxJQUFJLENBQUMsY0FBYyxDQUFDLG9CQUFvQixFQUFFO1FBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMsMEJBQTBCLFFBQVEsMkZBQTJGLENBQUMsQ0FBQztLQUNoSjtJQUVELE1BQU0sWUFBWSxHQUFHLENBQUMsTUFBTSxJQUFBLHNDQUFrQixFQUFDLGNBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0lBQzFGLElBQUksQ0FBQyxnQkFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsY0FBYyxDQUFDLG9CQUFvQixDQUFDLEVBQUU7UUFDeEUsTUFBTSxJQUFJLEtBQUssQ0FDYixhQUFhLFFBQVEsNERBQTRELFlBQVksa0JBQWtCLGNBQWMsQ0FBQyxvQkFBb0IsRUFBRSxDQUNySixDQUFDO0tBQ0g7QUFDSCxDQUFDO0FBRUQsa0JBQWUsS0FBSyxFQUFFLEVBQUUsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxXQUFXLEdBQUcsS0FBSyxFQUFFLFdBQVcsR0FBRyxLQUFLLEVBQUUsS0FBSyxHQUFHLEtBQUssRUFBRSxRQUFRLEdB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