"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const listr2_1 = require("listr2");
const forge_config_1 = __importDefault(require("../util/forge-config"));
const out_dir_1 = __importDefault(require("../util/out-dir"));
const publish_state_1 = __importDefault(require("../util/publish-state"));
const require_search_1 = __importDefault(require("../util/require-search"));
const resolve_dir_1 = __importDefault(require("../util/resolve-dir"));
const make_1 = require("./make");
const d = (0, debug_1.default)('electron-forge:publish');
const publish = async ({ dir: providedDir = process.cwd(), interactive = false, makeOptions = {}, publishTargets = undefined, dryRun = false, dryRunResume = false, outDir, }) => {
    if (dryRun && dryRunResume) {
        throw new Error("Can't dry run and resume a dry run at the same time");
    }
    const listrOptions = {
        concurrent: false,
        rendererOptions: {
            collapseErrors: false,
        },
        rendererSilent: !interactive,
        rendererFallback: Boolean(process.env.DEBUG),
    };
    const publishDistributablesTasks = [
        {
            title: 'Publishing distributables',
            task: async ({ dir, forgeConfig, makeResults, publishers }, task) => {
                if (publishers.length === 0) {
                    task.output = 'No publishers configured';
                    task.skip();
                    return;
                }
                return task.newListr(publishers.map((publisher) => ({
                    title: `${chalk_1.default.cyan(`[publisher-${publisher.name}]`)} Running the ${chalk_1.default.yellow('publish')} command`,
                    task: async (_, task) => {
                        const setStatusLine = (s) => {
                            task.output = s;
                        };
                        await publisher.publish({
                            dir,
                            makeResults: makeResults,
                            forgeConfig,
                            setStatusLine,
                        });
                    },
                    options: {
                        persistentOutput: true,
                    },
                })), {
                    rendererOptions: {
                        collapse: false,
                        collapseErrors: false,
                    },
                });
            },
            options: {
                persistentOutput: true,
            },
        },
    ];
    const runner = new listr2_1.Listr([
        {
            title: 'Loading configuration',
            task: async (ctx) => {
                const resolvedDir = await (0, resolve_dir_1.default)(providedDir);
                if (!resolvedDir) {
                    throw new Error('Failed to locate publishable Electron application');
                }
                ctx.dir = resolvedDir;
                ctx.forgeConfig = await (0, forge_config_1.default)(resolvedDir);
            },
        },
        {
            title: 'Resolving publish targets',
            task: async (ctx, task) => {
                const { dir, forgeConfig } = ctx;
                if (!publishTargets) {
                    publishTargets = forgeConfig.publishers || [];
                }
                publishTargets = publishTargets.map((target) => {
                    if (typeof target === 'string') {
                        return ((forgeConfig.publishers || []).find((p) => {
                            if (typeof p === 'string')
                                return false;
                            if (p.__isElectronForgePublisher)
                                return false;
                            return p.name === target;
                        }) || { name: target });
                    }
                    return target;
                });
                ctx.publishers = [];
                for (const publishTarget of publishTargets) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let publisher;
                    if (publishTarget.__isElectronForgePublisher) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        publisher = publishTarget;
                    }
                    else {
                        const resolvablePublishTarget = publishTarget;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const PublisherClass = (0, require_search_1.default)(dir, [resolvablePublishTarget.name]);
                        if (!PublisherClass) {
                            throw new Error(`Could not find a publish target with the name: ${resolvablePublishTarget.name}. Make sure it's listed in the devDependencies of your package.json`);
                        }
                        publisher = new PublisherClass(resolvablePublishTarget.config || {}, resolvablePublishTarget.platforms);
                    }
                    ctx.publishers.push(publisher);
                }
                if (ctx.publishers.length) {
                    task.output = `Publishing to the following targets: ${chalk_1.default.magenta(`${ctx.publishers.map((publisher) => publisher.name).join(', ')}`)}`;
                }
            },
            options: {
                persistentOutput: true,
            },
        },
        {
            title: dryRunResume ? 'Resuming from dry run...' : `Running ${chalk_1.default.yellow('make')} command`,
            task: async (ctx, task) => {
                const { dir, forgeConfig } = ctx;
                const calculatedOutDir = outDir || (0, out_dir_1.default)(dir, forgeConfig);
                const dryRunDir = path_1.default.resolve(calculatedOutDir, 'publish-dry-run');
                if (dryRunResume) {
                    d('attempting to resume from dry run');
                    const publishes = await publish_state_1.default.loadFromDirectory(dryRunDir, dir);
                    task.title = `Resuming ${publishes.length} found dry runs...`;
                    return task.newListr(publishes.map((publishStates, index) => {
                        return {
                            title: `Publishing dry-run ${chalk_1.default.blue(`#${index + 1}`)}`,
                            task: async (ctx, task) => {
                                const restoredMakeResults = publishStates.map(({ state }) => state);
                                d('restoring publish settings from dry run');
                                for (const makeResult of restoredMakeResults) {
                                    for (const makePath of makeResult.artifacts) {
                                        // standardize the path to artifacts across platforms
                                        const normalizedPath = makePath.split(/\/|\\/).join(path_1.default.sep);
                                        if (!(await fs_extra_1.default.pathExists(normalizedPath))) {
                                            throw new Error(`Attempted to resume a dry run but an artifact (${normalizedPath}) could not be found`);
                                        }
                                    }
                                }
                                d('publishing for given state set');
                                return task.newListr(publishDistributablesTasks, {
                                    ctx: {
                                        ...ctx,
                                        makeResults: restoredMakeResults,
                                    },
                                    rendererOptions: {
                                        collapse: false,
                                        collapseErrors: false,
                                    },
                                });
                            },
                        };
                    }), {
                        rendererOptions: {
                            collapse: false,
                            collapseErrors: false,
                        },
                    });
                }
                d('triggering make');
                return (0, make_1.listrMake)({
                    dir,
                    interactive,
                    ...makeOptions,
                }, (results) => {
                    ctx.makeResults = results;
                });
            },
        },
        ...(dryRunResume
            ? []
            : dryRun
                ? [
                    {
                        title: 'Saving dry-run state',
                        task: async ({ dir, forgeConfig, makeResults }) => {
                            d('saving results of make in dry run state', makeResults);
                            const calculatedOutDir = outDir || (0, out_dir_1.default)(dir, forgeConfig);
                            const dryRunDir = path_1.default.resolve(calculatedOutDir, 'publish-dry-run');
                            await fs_extra_1.default.remove(dryRunDir);
                            await publish_state_1.default.saveToDirectory(dryRunDir, makeResults, dir);
                        },
                    },
                ]
                : publishDistributablesTasks),
    ], listrOptions);
    await runner.run();
};
exports.default = publish;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvcHVibGlzaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdEQUF3QjtBQVl4QixrREFBMEI7QUFDMUIsa0RBQTBCO0FBQzFCLHdEQUEwQjtBQUMxQixtQ0FBK0I7QUFFL0Isd0VBQWtEO0FBQ2xELDhEQUErQztBQUMvQywwRUFBaUQ7QUFDakQsNEVBQW1EO0FBQ25ELHNFQUE2QztBQUU3QyxpQ0FBZ0Q7QUFFaEQsTUFBTSxDQUFDLEdBQUcsSUFBQSxlQUFLLEVBQUMsd0JBQXdCLENBQUMsQ0FBQztBQTJDMUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLEVBQ3JCLEdBQUcsRUFBRSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUNoQyxXQUFXLEdBQUcsS0FBSyxFQUNuQixXQUFXLEdBQUcsRUFBRSxFQUNoQixjQUFjLEdBQUcsU0FBUyxFQUMxQixNQUFNLEdBQUcsS0FBSyxFQUNkLFlBQVksR0FBRyxLQUFLLEVBQ3BCLE1BQU0sR0FDUyxFQUFpQixFQUFFO0lBQ2xDLElBQUksTUFBTSxJQUFJLFlBQVksRUFBRTtRQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7S0FDeEU7SUFFRCxNQUFNLFlBQVksR0FBRztRQUNuQixVQUFVLEVBQUUsS0FBSztRQUNqQixlQUFlLEVBQUU7WUFDZixjQUFjLEVBQUUsS0FBSztTQUN0QjtRQUNELGNBQWMsRUFBRSxDQUFDLFdBQVc7UUFDNUIsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0tBQzdDLENBQUM7SUFFRixNQUFNLDBCQUEwQixHQUFHO1FBQ2pDO1lBQ0UsS0FBSyxFQUFFLDJCQUEyQjtZQUNsQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFrQixF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