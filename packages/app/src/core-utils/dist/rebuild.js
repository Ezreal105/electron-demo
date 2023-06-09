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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listrCompatibleRebuildHook = void 0;
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const listrCompatibleRebuildHook = async (buildPath, electronVersion, platform, arch, config = {}, task, taskTitlePrefix = '') => {
    console.log('[wsttest] listrCompatibleRebuildHook')
    var _a, _b;
    task.title = `${taskTitlePrefix}Preparing native dependencies`;
    const options = {
        ...config,
        buildPath,
        electronVersion,
        arch,
    };
    const child = cp.fork(path.resolve(__dirname, 'remote-rebuild.js'), [JSON.stringify(options)], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    let pendingError;
    let found = 0;
    let done = 0;
    const redraw = () => {
        task.title = `${taskTitlePrefix}Preparing native dependencies: ${done} / ${found}`;
    };
    (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.on('data', (chunk) => {
        task.output = chunk.toString();
    });
    (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.on('data', (chunk) => {
        task.output = chunk.toString();
    });
    child.on('message', (message) => {
        switch (message.msg) {
            case 'module-found': {
                found += 1;
                redraw();
                break;
            }
            case 'module-done': {
                done += 1;
                redraw();
                break;
            }
            case 'rebuild-error': {
                pendingError = new Error(message.err.message);
                pendingError.stack = message.err.stack;
                break;
            }
            case 'rebuild-done': {
                task.task.rendererTaskOptions.persistentOutput = false;
                break;
            }
        }
    });
    await new Promise((resolve, reject) => {
        child.on('exit', (code) => {
            if (code === 0 && !pendingError) {
                resolve();
            }
            else {
                reject(pendingError || new Error(`Rebuilder failed with exit code: ${code}`));
            }
        });
    });
};
exports.listrCompatibleRebuildHook = listrCompatibleRebuildHook;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9yZWJ1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsa0RBQW9DO0FBQ3BDLDJDQUE2QjtBQUt0QixNQUFNLDBCQUEwQixHQUFHLEtBQUssRUFDN0MsU0FBaUIsRUFDakIsZUFBdUIsRUFDdkIsUUFBdUIsRUFDdkIsSUFBZSxFQUNmLFNBQWtDLEVBQUUsRUFDcEMsSUFBMkIsRUFDM0IsZUFBZSxHQUFHLEVBQUUsRUFDTCxFQUFFOztJQUNqQixJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsZUFBZSwrQkFBK0IsQ0FBQztJQUUvRCxNQUFNLE9BQU8sR0FBbUI7UUFDOUIsR0FBRyxNQUFNO1FBQ1QsU0FBUztRQUNULGVBQWU7UUFDZixJQUFJO0tBQ0wsQ0FBQztJQUVGLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsbUJBQW1CLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRTtRQUM3RixLQUFLLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUM7S0FDdkMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxZQUFtQixDQUFDO0lBQ3hCLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNkLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztJQUViLE1BQU0sTUFBTSxHQUFHLEdBQUcsRUFBRTtRQUNsQixJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsZUFBZSxrQ0FBa0MsSUFBSSxNQUFNLEtBQUssRUFBRSxDQUFDO0lBQ3JGLENBQUMsQ0FBQztJQUVGLE1BQUEsS0FBSyxDQUFDLE1BQU0sMENBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO1FBQ2pDLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBQ0gsTUFBQSxLQUFLLENBQUMsTUFBTSwwQ0FBRSxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7UUFDakMsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDakMsQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQWlFLEVBQUUsRUFBRTtRQUN4RixRQUFRLE9BQU8sQ0FBQyxHQUFHLEVBQUU7WUFDbkIsS0FBSyxjQUFjLENBQUMsQ0FBQztnQkFDbkIsS0FBSyxJQUFJLENBQUMsQ0FBQztnQkFDWCxNQUFNLEVBQUUsQ0FBQztnQkFDVCxNQUFNO2FBQ1A7WUFDRCxLQUFLLGFBQWEsQ0FBQyxDQUFDO2dCQUNsQixJQUFJLElBQUksQ0FBQyxDQUFDO2dCQUNWLE1BQU0sRUFBRSxDQUFDO2dCQUNULE1BQU07YUFDUDtZQUNELEtBQUssZUFBZSxDQUFDLENBQUM7Z0JBQ3BCLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUM5QyxZQUFZLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO2dCQUN2QyxNQUFNO2FBQ1A7WUFDRCxLQUFLLGNBQWMsQ0FBQyxDQUFDO2dCQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQztnQkFDdkQsTUFBTTthQUNQO1NBQ0Y7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDMUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN4QixJQUFJLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUU7Z0JBQy9CLE9BQU8sRUFBRSxDQUFDO2FBQ1g7aUJBQU07Z0JBQ0wsTUFBTSxDQUFDLFlBQVksSUFBSSxJQUFJLEtBQUssQ0FBQyxvQ0FBb0MsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQy9FO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQztBQXRFVyxRQUFBLDBCQUEwQiw4QkFzRXJDIn0=