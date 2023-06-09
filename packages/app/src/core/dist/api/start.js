"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const core_utils_1 = require("@electron-forge/core-utils");
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
const listr2_1 = require("listr2");
const electron_executable_1 = __importDefault(require("../util/electron-executable"));
const forge_config_1 = __importDefault(require("../util/forge-config"));
const hook_1 = require("../util/hook");
const read_package_json_1 = require("../util/read-package-json");
const resolve_dir_1 = __importDefault(require("../util/resolve-dir"));
const d = (0, debug_1.default)('electron-forge:start');
exports.default = async ({ dir: providedDir = process.cwd(), appPath = '.', interactive = false, enableLogging = false, args = [], runAsNode = false, inspect = false, inspectBrk = false, }) => {
    const platform = process.env.npm_config_platform || process.platform;
    const arch = process.env.npm_config_arch || process.arch;
    const listrOptions = {
        concurrent: false,
        rendererOptions: {
            collapseErrors: false,
        },
        rendererSilent: !interactive,
        rendererFallback: Boolean(process.env.DEBUG),
    };
    const runner = new listr2_1.Listr([
        {
            title: 'Locating application',
            task: async (ctx) => {
                const resolvedDir = await (0, resolve_dir_1.default)(providedDir);
                if (!resolvedDir) {
                    throw new Error('Failed to locate startable Electron application');
                }
                ctx.dir = resolvedDir;
            },
        },
        {
            title: 'Loading configuration',
            task: async (ctx) => {
                const { dir } = ctx;
                ctx.forgeConfig = await (0, forge_config_1.default)(dir);
                ctx.packageJSON = await (0, read_package_json_1.readMutatedPackageJson)(dir, ctx.forgeConfig);
                if (!ctx.packageJSON.version) {
                    throw new Error(`Please set your application's 'version' in '${dir}/package.json'.`);
                }
            },
        },
        {
            title: 'Preparing native dependencies',
            task: async ({ dir, forgeConfig, packageJSON }, task) => {
                await (0, core_utils_1.listrCompatibleRebuildHook)(dir, await (0, core_utils_1.getElectronVersion)(dir, packageJSON), platform, arch, forgeConfig.rebuildConfig, task);
            },
            options: {
                persistentOutput: true,
                bottomBar: Infinity,
                showTimer: true,
            },
        },
        {
            title: `Running ${chalk_1.default.yellow('generateAssets')} hook`,
            task: async ({ forgeConfig }, task) => {
                return task.newListr(await (0, hook_1.getHookListrTasks)(forgeConfig, 'generateAssets', platform, arch));
            },
        },
    ], listrOptions);
    await runner.run();
    const { dir, forgeConfig, packageJSON } = runner.ctx;
    let lastSpawned = null;
    const forgeSpawn = async () => {
        let electronExecPath = null;
        // If a plugin has taken over the start command let's stop here
        let spawnedPluginChild = await forgeConfig.pluginInterface.overrideStartLogic({
            dir,
            appPath,
            interactive,
            enableLogging,
            args,
            runAsNode,
            inspect,
            inspectBrk,
        });
        if (typeof spawnedPluginChild === 'object' && 'tasks' in spawnedPluginChild) {
            const innerRunner = new listr2_1.Listr([], listrOptions);
            for (const task of spawnedPluginChild.tasks) {
                innerRunner.add(task);
            }
            await innerRunner.run();
            spawnedPluginChild = spawnedPluginChild.result;
        }
        let prefixArgs = [];
        if (typeof spawnedPluginChild === 'string') {
            electronExecPath = spawnedPluginChild;
        }
        else if (Array.isArray(spawnedPluginChild)) {
            [electronExecPath, ...prefixArgs] = spawnedPluginChild;
        }
        else if (spawnedPluginChild) {
            await (0, hook_1.runHook)(forgeConfig, 'postStart', spawnedPluginChild);
            return spawnedPluginChild;
        }
        if (!electronExecPath) {
            electronExecPath = await (0, electron_executable_1.default)(dir, packageJSON);
        }
        d('Electron binary path:', electronExecPath);
        const spawnOpts = {
            cwd: dir,
            stdio: 'inherit',
            env: {
                ...process.env,
                ...(enableLogging
                    ? {
                        ELECTRON_ENABLE_LOGGING: 'true',
                        ELECTRON_ENABLE_STACK_DUMPING: 'true',
                    }
                    : {}),
            },
        };
        if (runAsNode) {
            spawnOpts.env.ELECTRON_RUN_AS_NODE = 'true';
        }
        else {
            delete spawnOpts.env.ELECTRON_RUN_AS_NODE;
        }
        if (inspect) {
            args = ['--inspect'].concat(args);
        }
        if (inspectBrk) {
            args = ['--inspect-brk'].concat(args);
        }
        const spawned = (0, child_process_1.spawn)(electronExecPath, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        prefixArgs.concat([appPath]).concat(args), spawnOpts);
        await (0, hook_1.runHook)(forgeConfig, 'postStart', spawned);
        return spawned;
    };
    const forgeSpawnWrapper = async () => {
        const spawned = await forgeSpawn();
        // When the child app is closed we should stop listening for stdin
        if (spawned) {
            if (interactive && process.stdin.isPaused()) {
                process.stdin.resume();
            }
            spawned.on('exit', () => {
                if (spawned.restarted) {
                    return;
                }
                if (interactive && !process.stdin.isPaused()) {
                    process.stdin.pause();
                }
            });
        }
        else if (interactive && !process.stdin.isPaused()) {
            process.stdin.pause();
        }
        lastSpawned = spawned;
        return lastSpawned;
    };
    if (interactive) {
        process.stdin.on('data', async (data) => {
            if (data.toString().trim() === 'rs' && lastSpawned) {
                console.info(chalk_1.default.cyan('\nRestarting App\n'));
                lastSpawned.restarted = true;
                lastSpawned.kill('SIGTERM');
                lastSpawned.emit('restarted', await forgeSpawnWrapper());
            }
        });
        process.stdin.resume();
    }
    const spawned = await forgeSpawnWrapper();
    if (interactive)
        console.log('');
    return spawned;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXBpL3N0YXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsaURBQW9EO0FBRXBELDJEQUE0RjtBQUU1RixrREFBMEI7QUFDMUIsa0RBQTBCO0FBQzFCLG1DQUErQjtBQUUvQixzRkFBbUU7QUFDbkUsd0VBQWtEO0FBQ2xELHVDQUEwRDtBQUMxRCxpRUFBbUU7QUFDbkUsc0VBQTZDO0FBRTdDLE1BQU0sQ0FBQyxHQUFHLElBQUEsZUFBSyxFQUFDLHNCQUFzQixDQUFDLENBQUM7QUFXeEMsa0JBQWUsS0FBSyxFQUFFLEVBQ3BCLEdBQUcsRUFBRSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUNoQyxPQUFPLEdBQUcsR0FBRyxFQUNiLFdBQVcsR0FBRyxLQUFLLEVBQ25CLGFBQWEsR0FBRyxLQUFLLEVBQ3JCLElBQUksR0FBRyxFQUFFLEVBQ1QsU0FBUyxHQUFHLEtBQUssRUFDakIsT0FBTyxHQUFHLEtBQUssRUFDZixVQUFVLEdBQUcsS0FBSyxHQUNMLEVBQTRCLEVBQUU7SUFDM0MsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDO0lBQ3JFLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDekQsTUFBTSxZQUFZLEdBQUc7UUFDbkIsVUFBVSxFQUFFLEtBQUs7UUFDakIsZUFBZSxFQUFFO1lBQ2YsY0FBYyxFQUFFLEtBQUs7U0FDdEI7UUFDRCxjQUFjLEVBQUUsQ0FBQyxXQUFXO1FBQzVCLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztLQUM3QyxDQUFDO0lBRUYsTUFBTSxNQUFNLEdBQUcsSUFBSSxjQUFLLENBQ3RCO1FBQ0U7WUFDRSxLQUFLLEVBQUUsc0JBQXNCO1lBQzdCLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEVBQUU7Z0JBQ2xCLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBQSxxQkFBVSxFQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUNsRCxJQUFJLENBQUMsV0FBVyxFQUFFO29CQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7aUJBQ3BFO2dCQUNELEdBQUcsQ0FBQyxHQUFHLEdBQUcsV0FBVyxDQUFDO1lBQ3hCLENBQUM7U0FDRjtRQUNEO1lBQ0UsS0FBSyxFQUFFLHVCQUF1QjtZQUM5QixJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUFFO2dCQUNsQixNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsR0FBRyxDQUFDO2dCQUNwQixHQUFHLENBQUMsV0FBVyxHQUFHLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1QyxHQUFHLENBQUMsV0FBVyxHQUFHLE1BQU0sSUFBQSwwQ0FBc0IsRUFBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUVyRSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7b0JBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0NBQStDLEdBQUcsaUJBQWlCLENBQUMsQ0FBQztpQkFDdEY7WUFDSCxDQUFDO1NBQ0Y7UUFDRDtZQUNFLEtBQUssRUFBRSwrQkFBK0I7WUFDdEMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3RELE1BQU0sSUFBQSx1Q0FBMEIsRUFDOUIsR0FBRyxFQUNILE1BQU0sSUFBQSwrQkFBa0IsRUFBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLEVBQzFDLFFBQXlCLEVBQ3pCLElBQWlCLEVBQ2pCLFdBQVcsQ0FBQyxhQUFhLEVBQ3pCLElBQTZCLENBQzlCLENBQUM7WUFDSixDQUFDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLFNBQVMsRUFBRSxRQUFRO2dCQUNuQixTQUFTLEVBQUUsSUFBSTthQUNoQjtTQUNGO1FBQ0Q7WUFDRSxLQUFLLEVBQUUsV0FBVyxlQUFLLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU87WUFDdkQsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFO2dCQUNwQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFBLHdCQUFpQixFQUFDLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMvRixDQUFDO1NBQ0Y7S0FDRixFQUNELFlBQVksQ0FDYixDQUFDO0lBRUYsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFbkIsTUFBTSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztJQUNyRCxJQUFJLFdBQVcsR0FBMkIsSUFBSSxDQUFDO0lBRS9DLE1BQU0sVUFBVSxHQUFHLEtBQUssSUFBSSxFQUFFO1FBQzVCLElBQUksZ0JBQWdCLEdBQWtCLElBQUksQ0FBQztRQUUzQywrREFBK0Q7UUFDL0QsSUFBSSxrQkFBa0IsR0FBRyxNQUFNLFdBQVcsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLENBQUM7WUFDNUUsR0FBRztZQUNILE9BQU87WUFDUCxXQUFXO1lBQ1gsYUFBYTtZQUNiLElBQUk7WUFDSixTQUFTO1lBQ1QsT0FBTztZQUNQLFVBQVU7U0FDWCxDQUFDLENBQUM7UUFDSCxJQUFJLE9BQU8sa0JBQWtCLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxrQkFBa0IsRUFBRTtZQUMzRSxNQUFNLFdBQVcsR0FBRyxJQUFJLGNBQUssQ0FBUSxFQUFFLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDdkQsS0FBSyxNQUFNLElBQUksSUFBSSxrQkFBa0IsQ0FBQyxLQUFLLEVBQUU7Z0JBQzNDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDdkI7WUFDRCxNQUFNLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN4QixrQkFBa0IsR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLENBQUM7U0FDaEQ7UUFDRCxJQUFJLFVBQVUsR0FBYSxFQUFFLENBQUM7UUFDOUIsSUFBSSxPQUFPLGtCQUFrQixLQUFLLFFBQVEsRUFBRTtZQUMxQyxnQkFBZ0IsR0FBRyxrQkFBa0IsQ0FBQztTQUN2QzthQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO1lBQzVDLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxVQUFVLENBQUMsR0FBRyxrQkFBa0IsQ0FBQztTQUN4RDthQUFNLElBQUksa0JBQWtCLEVBQUU7WUFDN0IsTUFBTSxJQUFBLGNBQU8sRUFBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDNUQsT0FBTyxrQkFBa0IsQ0FBQztTQUMzQjtRQUVELElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUNyQixnQkFBZ0IsR0FBRyxNQUFNLElBQUEsNkJBQXdCLEVBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1NBQ3JFO1FBRUQsQ0FBQyxDQUFDLHVCQUF1QixFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFN0MsTUFBTSxTQUFTLEdBQUc7WUFDaEIsR0FBRyxFQUFFLEdBQUc7WUFDUixLQUFLLEVBQUUsU0FBUztZQUNoQixHQUFHLEVBQUU7Z0JBQ0gsR0FBRyxPQUFPLENBQUMsR0FBRztnQkFDZCxHQUFHLENBQUMsYUFBYTtvQkFDZixDQUFDLENBQUM7d0JBQ0UsdUJBQXVCLEVBQUUsTUFBTTt3QkFDL0IsNkJBQTZCLEVBQUUsTUFBTTtxQkFDdEM7b0JBQ0gsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUNhO1NBQ3ZCLENBQUM7UUFFRixJQUFJLFNBQVMsRUFBRTtZQUNiLFNBQVMsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEdBQUcsTUFBTSxDQUFDO1NBQzdDO2FBQU07WUFDTCxPQUFPLFNBQVMsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUM7U0FDM0M7UUFFRCxJQUFJLE9BQU8sRUFBRTtZQUNYLElBQUksR0FBRyxDQUFDLFdBQThCLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdEQ7UUFDRCxJQUFJLFVBQVUsRUFBRTtZQUNkLElBQUksR0FBRyxDQUFDLGVBQWtDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDMUQ7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFBLHFCQUFLLEVBQ25CLGdCQUFpQixFQUFFLCtEQUErRDtRQUNsRixVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBZ0IsQ0FBQyxFQUNyRCxTQUF5QixDQUNQLENBQUM7UUFFckIsTUFBTSxJQUFBLGNBQU8sRUFBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUMsQ0FBQztJQUVGLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDbkMsTUFBTSxPQUFPLEdBQUcsTUFBTSxVQUFVLEVBQUUsQ0FBQztRQUNuQyxrRUFBa0U7UUFDbEUsSUFBSSxPQUFPLEVBQUU7WUFDWCxJQUFJLFdBQVcsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFO2dCQUMzQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ3hCO1lBQ0QsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFO2dCQUN0QixJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUU7b0JBQ3JCLE9BQU87aUJBQ1I7Z0JBRUQsSUFBSSxXQUFXLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFO29CQUM1QyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO2lCQUN2QjtZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7YUFBTSxJQUFJLFdBQVcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDbkQsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztTQUN2QjtRQUVELFdBQVcsR0FBRyxPQUFPLENBQUM7UUFDdEIsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQyxDQUFDO0lBRUYsSUFBSSxXQUFXLEVBQUU7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO1lBQ3RDLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksSUFBSSxXQUFXLEVBQUU7Z0JBQ2xELE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBSyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7Z0JBQy9DLFdBQVcsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUM3QixXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUM1QixXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxNQUFNLGlCQUFpQixFQUFFLENBQUMsQ0FBQzthQUMxRDtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztLQUN4QjtJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0saUJBQWlCLEVBQUUsQ0FBQztJQUUxQyxJQUFJLFdBQVc7UUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRWpDLE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUMsQ0FBQyJ9