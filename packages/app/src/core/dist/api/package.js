"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.listrPackage = void 0;
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const core_utils_1 = require("@electron-forge/core-utils");
const get_1 = require("@electron/get");
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
const electron_packager_1 = __importDefault(require("electron-packager"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const listr2_1 = require("listr2");
const forge_config_1 = __importDefault(require("../util/forge-config"));
const hook_1 = require("../util/hook");
const messages_1 = require("../util/messages");
const out_dir_1 = __importDefault(require("../util/out-dir"));
const read_package_json_1 = require("../util/read-package-json");
const require_search_1 = __importDefault(require("../util/require-search"));
const resolve_dir_1 = __importDefault(require("../util/resolve-dir"));
const d = (0, debug_1.default)("electron-forge:packager");
// const dirTree = require("directory-tree");
const np = require("normalize-path");
/**
 * Resolves hooks if they are a path to a file (instead of a `Function`).
 */
function resolveHooks(hooks, dir) {
  if (hooks) {
    return hooks.map((hook) =>
      typeof hook === "string"
        ? (0, require_search_1.default)(dir, [hook])
        : hook
    );
  }
  return [];
}
/**
 * Runs given hooks sequentially by mapping them to promises and iterating
 * through while awaiting
 */
function sequentialHooks(hooks) {
  return [
    async (buildPath, electronVersion, platform, arch, done) => {
      for (const hook of hooks) {
        try {
          await (0, util_1.promisify)(hook)(
            buildPath,
            electronVersion,
            platform,
            arch
          );
        } catch (err) {
          d("hook failed:", hook.toString(), err);
          return done(err);
        }
      }
      done();
    },
  ];
}
function sequentialFinalizePackageTargetsHooks(hooks) {
  return [
    async (targets, done) => {
      for (const hook of hooks) {
        try {
          await (0, util_1.promisify)(hook)(targets);
        } catch (err) {
          return done(err);
        }
      }
      done();
    },
  ];
}
const listrPackage = ({
  dir: providedDir = process.cwd(),
  interactive = false,
  arch = (0, get_1.getHostArch)(),
  platform = process.platform,
  outDir,
}) => {
  const runner = new listr2_1.Listr(
    [
      {
        title: "Preparing to package application",
        task: async (ctx) => {
          const resolvedDir = await (0, resolve_dir_1.default)(providedDir);
          if (!resolvedDir) {
            throw new Error("Failed to locate compilable Electron application");
          }
          ctx.dir = resolvedDir;
          ctx.forgeConfig = await (0, forge_config_1.default)(resolvedDir);
          ctx.packageJSON = await (0,
          read_package_json_1.readMutatedPackageJson)(
            resolvedDir,
            ctx.forgeConfig
          );
          if (!ctx.packageJSON.main) {
            throw new Error(
              "packageJSON.main must be set to a valid entry point for your Electron app"
            );
          }
          ctx.calculatedOutDir =
            outDir || (0, out_dir_1.default)(resolvedDir, ctx.forgeConfig);
        },
      },
      {
        title: "Running packaging hooks",
        task: async ({ forgeConfig }, task) => {
          return task.newListr([
            {
              title: `Running ${chalk_1.default.yellow("generateAssets")} hook`,
              task: async (_, task) => {
                return task.newListr(
                  await (0, hook_1.getHookListrTasks)(
                    forgeConfig,
                    "generateAssets",
                    platform,
                    arch
                  )
                );
              },
            },
            {
              title: `Running ${chalk_1.default.yellow("prePackage")} hook`,
              task: async (_, task) => {
                return task.newListr(
                  await (0, hook_1.getHookListrTasks)(
                    forgeConfig,
                    "prePackage",
                    platform,
                    arch
                  )
                );
              },
            },
          ]);
        },
      },
      {
        title: "Packaging application",
        task: async (ctx, task) => {
          const { calculatedOutDir, forgeConfig, packageJSON } = ctx;
          const getTargetKey = (target) => `${target.platform}/${target.arch}`;
          task.output = "Determining targets...";
          const signalCopyDone = new Map();
          const signalRebuildDone = new Map();
          const signalPackageDone = new Map();
          const rejects = [];
          const signalDone = (map, target) => {
            var _a, _b;
            (_b =
              (_a = map.get(getTargetKey(target))) === null || _a === void 0
                ? void 0
                : _a.pop()) === null || _b === void 0
              ? void 0
              : _b();
          };
          const addSignalAndWait = async (map, target) => {
            const targetKey = getTargetKey(target);
            await new Promise((resolve, reject) => {
              rejects.push(reject);
              map.set(targetKey, (map.get(targetKey) || []).concat([resolve]));
            });
          };
          let provideTargets;
          const targetsPromise = new Promise((resolve, reject) => {
            provideTargets = resolve;
            rejects.push(reject);
          });
          const rebuildTasks = new Map();
          const signalRebuildStart = new Map();
          const afterFinalizePackageTargetsHooks = [
            (targets, done) => {
              provideTargets(targets);
              done();
            },
            ...resolveHooks(
              forgeConfig.packagerConfig.afterFinalizePackageTargets,
              ctx.dir
            ),
          ];
          const pruneEnabled =
            !("prune" in forgeConfig.packagerConfig) ||
            forgeConfig.packagerConfig.prune;
          const afterCopyHooks = [
            async (buildPath, electronVersion, platform, arch, done) => {
              signalDone(signalCopyDone, { platform, arch });
              done();
            },
            async (buildPath, electronVersion, pPlatform, pArch, done) => {
              // console.log(
              //   "[wsttest] afterCopyHook2",
              //   buildPath,
              //   path_1.default.join(buildPath, "**/.bin/**/*")
              // );
              // const files = await fs_extra_1.default.readdir(buildPath);
              // const tree = dirTree(buildPath);
              // console.log("[wsttest] files", files, JSON.stringify(tree));
              const bins = await (0, fast_glob_1.default)(
                np(path_1.default.join(buildPath, "**/.bin/**/*"))
              );
              console.log("[wsttest] afterCopyHook2 bins", bins);
              for (const bin of bins) {
                console.log("[wsttest] afterCopyHook2 bin", bin);
                await fs_extra_1.default.remove(bin);
                console.log("[wsttest] afterCopyHook2 bin after", bin);
              }
              done();
            },
            async (buildPath, electronVersion, pPlatform, pArch, done) => {
              await (0, hook_1.runHook)(
                forgeConfig,
                "packageAfterCopy",
                buildPath,
                electronVersion,
                pPlatform,
                pArch
              );
              done();
            },
            async (buildPath, electronVersion, pPlatform, pArch, done) => {
              console.log("[wsttest] afterCopyHook4");
              var _a, _b;
              const targetKey = getTargetKey({
                platform: pPlatform,
                arch: pArch,
              });
              await (0, core_utils_1.listrCompatibleRebuildHook)(
                buildPath,
                electronVersion,
                pPlatform,
                pArch,
                forgeConfig.rebuildConfig,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                await rebuildTasks.get(targetKey).pop()
              );
              (_b =
                (_a = signalRebuildDone.get(targetKey)) === null ||
                _a === void 0
                  ? void 0
                  : _a.pop()) === null || _b === void 0
                ? void 0
                : _b();
              done();
            },
            async (buildPath, electronVersion, pPlatform, pArch, done) => {
              const copiedPackageJSON = await (0,
              read_package_json_1.readMutatedPackageJson)(
                buildPath,
                forgeConfig
              );
              if (copiedPackageJSON.config && copiedPackageJSON.config.forge) {
                delete copiedPackageJSON.config.forge;
              }
              await fs_extra_1.default.writeJson(
                path_1.default.resolve(buildPath, "package.json"),
                copiedPackageJSON,
                { spaces: 2 }
              );
              done();
            },
            ...resolveHooks(forgeConfig.packagerConfig.afterCopy, ctx.dir),
          ];
          const afterCompleteHooks = [
            async (buildPath, electronVersion, pPlatform, pArch, done) => {
              var _a, _b;
              (_b =
                (_a = signalPackageDone.get(
                  getTargetKey({ platform: pPlatform, arch: pArch })
                )) === null || _a === void 0
                  ? void 0
                  : _a.pop()) === null || _b === void 0
                ? void 0
                : _b();
              done();
            },
          ];
          const afterPruneHooks = [];
          if (pruneEnabled) {
            afterPruneHooks.push(
              ...resolveHooks(forgeConfig.packagerConfig.afterPrune, ctx.dir)
            );
          }
          afterPruneHooks.push(
            async (buildPath, electronVersion, pPlatform, pArch, done) => {
              await (0, hook_1.runHook)(
                forgeConfig,
                "packageAfterPrune",
                buildPath,
                electronVersion,
                pPlatform,
                pArch
              );
              done();
            }
          );
          const afterExtractHooks = [
            async (buildPath, electronVersion, pPlatform, pArch, done) => {
              await (0, hook_1.runHook)(
                forgeConfig,
                "packageAfterExtract",
                buildPath,
                electronVersion,
                pPlatform,
                pArch
              );
              done();
            },
          ];
          afterExtractHooks.push(
            ...resolveHooks(forgeConfig.packagerConfig.afterExtract, ctx.dir)
          );
          const packageOpts = {
            asar: false,
            overwrite: true,
            ignore: [/^\/out\//g],
            ...forgeConfig.packagerConfig,
            quiet: true,
            dir: ctx.dir,
            arch: arch,
            platform,
            afterFinalizePackageTargets: sequentialFinalizePackageTargetsHooks(
              afterFinalizePackageTargetsHooks
            ),
            afterComplete: sequentialHooks(afterCompleteHooks),
            afterCopy: sequentialHooks(afterCopyHooks),
            afterExtract: sequentialHooks(afterExtractHooks),
            afterPrune: sequentialHooks(afterPruneHooks),
            out: calculatedOutDir,
            electronVersion: await (0, core_utils_1.getElectronVersion)(
              ctx.dir,
              packageJSON
            ),
          };
          packageOpts.quiet = true;
          if (packageOpts.all) {
            throw new Error(
              "config.forge.packagerConfig.all is not supported by Electron Forge"
            );
          }
          if (!packageJSON.version && !packageOpts.appVersion) {
            (0, messages_1.warn)(
              interactive,
              chalk_1.default.yellow(
                'Please set "version" or "config.forge.packagerConfig.appVersion" in your application\'s package.json so auto-updates work properly'
              )
            );
          }
          if (packageOpts.prebuiltAsar) {
            throw new Error(
              "config.forge.packagerConfig.prebuiltAsar is not supported by Electron Forge"
            );
          }
          d("packaging with options", packageOpts);
          ctx.packagerPromise = (0, electron_packager_1.default)(packageOpts);
          // Handle error by failing this task
          // rejects is populated by the reject handlers for every
          // signal based promise in every subtask
          ctx.packagerPromise.catch((err) => {
            for (const reject of rejects) {
              reject(err);
            }
          });
          const targets = await targetsPromise;
          // Copy the resolved targets into the context for later
          ctx.targets = [...targets];
          // If we are targetting a universal build we need to add the "fake"
          // x64 and arm64 builds into the list of targets so that we can
          // show progress for those
          for (const target of targets) {
            if (target.arch === "universal") {
              targets.push(
                {
                  platform: target.platform,
                  arch: "x64",
                  forUniversal: true,
                },
                {
                  platform: target.platform,
                  arch: "arm64",
                  forUniversal: true,
                }
              );
            }
          }
          // Populate rebuildTasks with promises that resolve with the rebuild tasks
          // that will eventually run
          for (const target of targets) {
            // Skip universal tasks as they do not have rebuild sub-tasks
            if (target.arch === "universal") continue;
            const targetKey = getTargetKey(target);
            rebuildTasks.set(
              targetKey,
              (rebuildTasks.get(targetKey) || []).concat([
                new Promise((resolve) => {
                  signalRebuildStart.set(
                    targetKey,
                    (signalRebuildStart.get(targetKey) || []).concat([resolve])
                  );
                }),
              ])
            );
          }
          d("targets:", targets);
          return task.newListr(
            targets.map((target) =>
              target.arch === "universal"
                ? {
                    title: `Stitching ${chalk_1.default.cyan(
                      `${target.platform}/x64`
                    )} and ${chalk_1.default.cyan(
                      `${target.platform}/arm64`
                    )} into a ${chalk_1.default.green(
                      `${target.platform}/universal`
                    )} package`,
                    task: async () => {
                      await addSignalAndWait(signalPackageDone, target);
                    },
                    options: {
                      showTimer: true,
                    },
                  }
                : {
                    title: `Packaging for ${chalk_1.default.cyan(
                      target.arch
                    )} on ${chalk_1.default.cyan(target.platform)}${
                      target.forUniversal
                        ? chalk_1.default.italic(" (for universal package)")
                        : ""
                    }`,
                    task: async (_, task) => {
                      return task.newListr(
                        [
                          {
                            title: "Copying files",
                            task: async () => {
                              await addSignalAndWait(signalCopyDone, target);
                            },
                          },
                          {
                            title: "Preparing native dependencies",
                            task: async (_, task) => {
                              var _a, _b;
                              (_b =
                                (_a = signalRebuildStart.get(
                                  getTargetKey(target)
                                )) === null || _a === void 0
                                  ? void 0
                                  : _a.pop()) === null || _b === void 0
                                ? void 0
                                : _b(task);
                              await addSignalAndWait(signalRebuildDone, target);
                            },
                            options: {
                              persistentOutput: true,
                              bottomBar: Infinity,
                              showTimer: true,
                            },
                          },
                          {
                            title: "Finalizing package",
                            task: async () => {
                              await addSignalAndWait(signalPackageDone, target);
                            },
                          },
                        ],
                        {
                          rendererOptions: {
                            collapse: true,
                            collapseErrors: false,
                          },
                        }
                      );
                    },
                    options: {
                      showTimer: true,
                    },
                  }
            ),
            {
              concurrent: true,
              rendererOptions: { collapse: false, collapseErrors: false },
            }
          );
        },
      },
      {
        title: `Running ${chalk_1.default.yellow("postPackage")} hook`,
        task: async ({ packagerPromise, forgeConfig }, task) => {
          const outputPaths = await packagerPromise;
          d("outputPaths:", outputPaths);
          return task.newListr(
            await (0, hook_1.getHookListrTasks)(forgeConfig, "postPackage", {
              arch,
              outputPaths,
              platform,
            })
          );
        },
      },
    ],
    {
      concurrent: false,
      rendererSilent: !interactive,
      rendererFallback: Boolean(process.env.DEBUG),
      rendererOptions: {
        collapse: false,
        collapseErrors: false,
      },
      ctx: {},
    }
  );
  return runner;
};
exports.listrPackage = listrPackage;
exports.default = async (opts) => {
  const runner = (0, exports.listrPackage)(opts);
  await runner.run();
  const outputPaths = await runner.ctx.packagerPromise;
  return runner.ctx.targets.map((target, index) => ({
    platform: target.platform,
    arch: target.arch,
    packagedPath: outputPaths[index],
  }));
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvcGFja2FnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxnREFBd0I7QUFDeEIsK0JBQWlDO0FBRWpDLDJEQUE0RjtBQUU1Rix1Q0FBNEM7QUFDNUMsa0RBQTBCO0FBQzFCLGtEQUEwQjtBQUMxQiwwRUFBaUg7QUFDakgsMERBQTZCO0FBQzdCLHdEQUEwQjtBQUMxQixtQ0FBK0I7QUFFL0Isd0VBQWtEO0FBQ2xELHVDQUEwRDtBQUMxRCwrQ0FBd0M7QUFDeEMsOERBQStDO0FBQy9DLGlFQUFtRTtBQUNuRSw0RUFBbUQ7QUFDbkQsc0VBQTZDO0FBRTdDLE1BQU0sQ0FBQyxHQUFHLElBQUEsZUFBSyxFQUFDLHlCQUF5QixDQUFDLENBQUM7QUFFM0M7O0dBRUc7QUFDSCxTQUFTLFlBQVksQ0FBbUIsS0FBaUMsRUFBRSxHQUFXO0lBQ3BGLElBQUksS0FBSyxFQUFFO1FBQ1QsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUUsSUFBQSx3QkFBYSxFQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDdEc7SUFFRCxPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUM7QUFNRDs7O0dBR0c7QUFDSCxTQUFTLGVBQWUsQ0FBQyxLQUFxQjtJQUM1QyxPQUFPO1FBQ0wsS0FBSyxFQUFFLFNBQWlCLEVBQUUsZUFBdUIsRUFBRSxRQUFnQixFQUFFLElBQVksRUFBRSxJQUFrQixFQUFFLEVBQUU7WUFDdkcsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7Z0JBQ3hCLElBQUk7b0JBQ0YsTUFBTSxJQUFBLGdCQUFTLEVBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLGVBQWUs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
