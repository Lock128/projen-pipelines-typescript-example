#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const standard_version_1 = __importDefault(require("standard-version"));
function createManifest(outDir, namespace) {
    const projectInfo = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)('package.json')).toString('utf-8'));
    const assemblyManifest = JSON.stringify({
        name: `${namespace}/${projectInfo.name}`,
        author: projectInfo.author,
        license: projectInfo.license,
        version: '0.0.0',
    }, null, 2);
    (0, fs_1.writeFileSync)((0, path_1.join)(outDir, 'package.json'), assemblyManifest, { encoding: 'utf-8' });
    const rcFile = (0, path_1.join)(outDir, '.npmrc');
    if ((0, fs_1.existsSync)(rcFile)) {
        (0, fs_1.rmSync)(rcFile, { force: true });
    }
    (0, fs_1.copyFileSync)('.npmrc', rcFile);
}
function bumpVersion() {
    void (0, standard_version_1.default)({
        packageFiles: [],
        bumpFiles: [],
        skip: {
            commit: true,
            changelog: true,
        },
        firstRelease: false,
        gitTagFallback: true,
        tagPrefix: '',
    }).then(console.log).catch(console.error);
}
switch (process.argv[2]) {
    case 'create-manifest':
        createManifest(process.argv[3], process.argv[4]);
        break;
    case 'bump':
        bumpVersion();
        break;
    default:
        console.log('Cannot find command: ' + process.argv[2]);
        break;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsZWFzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9yZWxlYXNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUVBLDJCQUFtRjtBQUNuRiwrQkFBNEI7QUFDNUIsd0VBQXNDO0FBRXRDLFNBQVMsY0FBYyxDQUFDLE1BQWMsRUFBRSxTQUFpQjtJQUN2RCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUEsaUJBQVksRUFBQyxJQUFBLFdBQUksRUFBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3JGLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLEVBQUUsR0FBRyxTQUFTLElBQUksV0FBVyxDQUFDLElBQUksRUFBRTtRQUN4QyxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU07UUFDMUIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPO1FBQzVCLE9BQU8sRUFBRSxPQUFPO0tBQ2pCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ1osSUFBQSxrQkFBYSxFQUFDLElBQUEsV0FBSSxFQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBRXJGLE1BQU0sTUFBTSxHQUFHLElBQUEsV0FBSSxFQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN0QyxJQUFJLElBQUEsZUFBVSxFQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3RCLElBQUEsV0FBTSxFQUFDLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0tBQ2pDO0lBQ0QsSUFBQSxpQkFBWSxFQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBRUQsU0FBUyxXQUFXO0lBQ2xCLEtBQUssSUFBQSwwQkFBTSxFQUFDO1FBQ1YsWUFBWSxFQUFFLEVBQUU7UUFDaEIsU0FBUyxFQUFFLEVBQUU7UUFDYixJQUFJLEVBQUU7WUFDSixNQUFNLEVBQUUsSUFBSTtZQUNaLFNBQVMsRUFBRSxJQUFJO1NBQ2hCO1FBQ0QsWUFBWSxFQUFFLEtBQUs7UUFDbkIsY0FBYyxFQUFFLElBQUk7UUFDcEIsU0FBUyxFQUFFLEVBQUU7S0FDZCxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFFRCxRQUFRLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDdkIsS0FBSyxpQkFBaUI7UUFDcEIsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pELE1BQU07SUFDUixLQUFLLE1BQU07UUFDVCxXQUFXLEVBQUUsQ0FBQztRQUNkLE1BQU07SUFDUjtRQUNFLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELE1BQU07Q0FDVCIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcblxuaW1wb3J0IHsgY29weUZpbGVTeW5jLCBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMsIHdyaXRlRmlsZVN5bmMsIHJtU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBzdGRWZXIgZnJvbSAnc3RhbmRhcmQtdmVyc2lvbic7XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hbmlmZXN0KG91dERpcjogc3RyaW5nLCBuYW1lc3BhY2U6IHN0cmluZykge1xuICBjb25zdCBwcm9qZWN0SW5mbyA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKGpvaW4oJ3BhY2thZ2UuanNvbicpKS50b1N0cmluZygndXRmLTgnKSk7XG4gIGNvbnN0IGFzc2VtYmx5TWFuaWZlc3QgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgbmFtZTogYCR7bmFtZXNwYWNlfS8ke3Byb2plY3RJbmZvLm5hbWV9YCxcbiAgICBhdXRob3I6IHByb2plY3RJbmZvLmF1dGhvcixcbiAgICBsaWNlbnNlOiBwcm9qZWN0SW5mby5saWNlbnNlLFxuICAgIHZlcnNpb246ICcwLjAuMCcsXG4gIH0sIG51bGwsIDIpO1xuICB3cml0ZUZpbGVTeW5jKGpvaW4ob3V0RGlyLCAncGFja2FnZS5qc29uJyksIGFzc2VtYmx5TWFuaWZlc3QsIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSk7XG5cbiAgY29uc3QgcmNGaWxlID0gam9pbihvdXREaXIsICcubnBtcmMnKTtcbiAgaWYgKGV4aXN0c1N5bmMocmNGaWxlKSkge1xuICAgIHJtU3luYyhyY0ZpbGUsIHsgZm9yY2U6IHRydWUgfSk7XG4gIH1cbiAgY29weUZpbGVTeW5jKCcubnBtcmMnLCByY0ZpbGUpO1xufVxuXG5mdW5jdGlvbiBidW1wVmVyc2lvbigpIHtcbiAgdm9pZCBzdGRWZXIoe1xuICAgIHBhY2thZ2VGaWxlczogW10sXG4gICAgYnVtcEZpbGVzOiBbXSxcbiAgICBza2lwOiB7XG4gICAgICBjb21taXQ6IHRydWUsXG4gICAgICBjaGFuZ2Vsb2c6IHRydWUsXG4gICAgfSxcbiAgICBmaXJzdFJlbGVhc2U6IGZhbHNlLFxuICAgIGdpdFRhZ0ZhbGxiYWNrOiB0cnVlLFxuICAgIHRhZ1ByZWZpeDogJycsXG4gIH0pLnRoZW4oY29uc29sZS5sb2cpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xufVxuXG5zd2l0Y2ggKHByb2Nlc3MuYXJndlsyXSkge1xuICBjYXNlICdjcmVhdGUtbWFuaWZlc3QnOlxuICAgIGNyZWF0ZU1hbmlmZXN0KHByb2Nlc3MuYXJndlszXSwgcHJvY2Vzcy5hcmd2WzRdKTtcbiAgICBicmVhaztcbiAgY2FzZSAnYnVtcCc6XG4gICAgYnVtcFZlcnNpb24oKTtcbiAgICBicmVhaztcbiAgZGVmYXVsdDpcbiAgICBjb25zb2xlLmxvZygnQ2Fubm90IGZpbmQgY29tbWFuZDogJyArIHByb2Nlc3MuYXJndlsyXSk7XG4gICAgYnJlYWs7XG59XG4iXX0=