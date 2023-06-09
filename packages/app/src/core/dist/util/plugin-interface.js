"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_base_1 = require("@electron-forge/plugin-base");
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
const require_search_1 = __importDefault(require("./require-search"));
const d = (0, debug_1.default)('electron-forge:plugins');
function isForgePlugin(plugin) {
    return plugin.__isElectronForgePlugin;
}
class PluginInterface {
    constructor(dir, forgeConfig) {
        this.plugins = forgeConfig.plugins.map((plugin) => {
            if (isForgePlugin(plugin)) {
                return plugin;
            }
            if (typeof plugin === 'object' && 'name' in plugin && 'config' in plugin) {
                const { name: pluginName, config: opts } = plugin;
                if (typeof pluginName !== 'string') {
                    throw new Error(`Expected plugin[0] to be a string but found ${pluginName}`);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const Plugin = (0, require_search_1.default)(dir, [pluginName]);
                if (!Plugin) {
                    throw new Error(`Could not find module with name: ${pluginName}. Make sure it's listed in the devDependencies of your package.json`);
                }
                return new Plugin(opts);
            }
            throw new Error(`Expected plugin to either be a plugin instance or a { name, config } object but found ${plugin}`);
        });
        // TODO: fix hack
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.config = null;
        Object.defineProperty(this, 'config', {
            value: forgeConfig,
            enumerable: false,
            configurable: false,
            writable: false,
        });
        for (const plugin of this.plugins) {
            plugin.init(dir, forgeConfig);
        }
        this.triggerHook = this.triggerHook.bind(this);
        this.overrideStartLogic = this.overrideStartLogic.bind(this);
    }
    async triggerHook(hookName, hookArgs) {
        for (const plugin of this.plugins) {
            if (typeof plugin.getHooks === 'function') {
                let hooks = plugin.getHooks()[hookName];
                if (hooks) {
                    if (typeof hooks === 'function')
                        hooks = [hooks];
                    for (const hook of hooks) {
                        await hook(this.config, ...hookArgs);
                    }
                }
            }
        }
    }
    async getHookListrTasks(hookName, hookArgs) {
        const tasks = [];
        for (const plugin of this.plugins) {
            if (typeof plugin.getHooks === 'function') {
                let hooks = plugin.getHooks()[hookName];
                if (hooks) {
                    if (typeof hooks === 'function')
                        hooks = [hooks];
                    for (const hook of hooks) {
                        tasks.push({
                            title: `${chalk_1.default.cyan(`[plugin-${plugin.name}]`)} ${hook.__hookName || `Running ${chalk_1.default.yellow(hookName)} hook`}`,
                            task: async (_, task) => {
                                if (hook.__hookName) {
                                    // Also give it the task
                                    await hook.call(task, this.config, ...hookArgs);
                                }
                                else {
                                    await hook(this.config, ...hookArgs);
                                }
                            },
                            options: {},
                        });
                    }
                }
            }
        }
        return tasks;
    }
    async triggerMutatingHook(hookName, ...item) {
        let result = item[0];
        for (const plugin of this.plugins) {
            if (typeof plugin.getHooks === 'function') {
                let hooks = plugin.getHooks()[hookName];
                if (hooks) {
                    if (typeof hooks === 'function')
                        hooks = [hooks];
                    for (const hook of hooks) {
                        result = (await hook(this.config, ...item)) || result;
                    }
                }
            }
        }
        return result;
    }
    async overrideStartLogic(opts) {
        let newStartFn;
        const claimed = [];
        for (const plugin of this.plugins) {
            if (typeof plugin.startLogic === 'function' && plugin.startLogic !== plugin_base_1.PluginBase.prototype.startLogic) {
                claimed.push(plugin.name);
                newStartFn = plugin.startLogic;
            }
        }
        if (claimed.length > 1) {
            throw new Error(`Multiple plugins tried to take control of the start command, please remove one of them\n --> ${claimed.join(', ')}`);
        }
        if (claimed.length === 1 && newStartFn) {
            d(`plugin: "${claimed[0]}" has taken control of the start command`);
            const result = await newStartFn(opts);
            if (typeof result === 'object' && 'tasks' in result) {
                result.tasks = result.tasks.map((task) => ({
                    ...task,
                    title: `${chalk_1.default.cyan(`[plugin-${claimed[0]}]`)} ${task.title}`,
                }));
            }
            return result;
        }
        return false;
    }
}
exports.default = PluginInterface;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGx1Z2luLWludGVyZmFjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL3BsdWdpbi1pbnRlcmZhY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw2REFBeUQ7QUFZekQsa0RBQTBCO0FBQzFCLGtEQUEwQjtBQUkxQixzRUFBNkM7QUFFN0MsTUFBTSxDQUFDLEdBQUcsSUFBQSxlQUFLLEVBQUMsd0JBQXdCLENBQUMsQ0FBQztBQUUxQyxTQUFTLGFBQWEsQ0FBQyxNQUE4QjtJQUNuRCxPQUFRLE1BQXVCLENBQUMsdUJBQXVCLENBQUM7QUFDMUQsQ0FBQztBQUVELE1BQXFCLGVBQWU7SUFLbEMsWUFBWSxHQUFXLEVBQUUsV0FBZ0M7UUFDdkQsSUFBSSxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ2hELElBQUksYUFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN6QixPQUFPLE1BQU0sQ0FBQzthQUNmO1lBRUQsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLElBQUksTUFBTSxJQUFJLE1BQU0sSUFBSSxRQUFRLElBQUksTUFBTSxFQUFFO2dCQUN4RSxNQUFNLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDO2dCQUNsRCxJQUFJLE9BQU8sVUFBVSxLQUFLLFFBQVEsRUFBRTtvQkFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQywrQ0FBK0MsVUFBVSxFQUFFLENBQUMsQ0FBQztpQkFDOUU7Z0JBQ0QsOERBQThEO2dCQUM5RCxNQUFNLE1BQU0sR0FBRyxJQUFBLHdCQUFhLEVBQU0sR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDckQsSUFBSSxDQUFDLE1BQU0sRUFBRTtvQkFDWCxNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxVQUFVLHFFQUFxRSxDQUFD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