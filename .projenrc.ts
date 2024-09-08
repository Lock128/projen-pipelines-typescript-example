import { awscdk } from 'projen';
import { NodePackageManager } from 'projen/lib/javascript';
import { CodeCatalystCDKPipeline } from 'projen-pipelines';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'projen-pipelines-typescript-example',
  projenrcTs: true,
  github: true,
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
  devDeps: [
    'projen-pipelines',
    '@amazon-codecatalyst/blueprint-component.workflows',
  ],

  packageManager: NodePackageManager.NPM,

});
//project.addJestNoCompileModern = false;
//addJestNoCompileModern, addJestNoCompileLegacy, determineInstallWorkingDirectory, node

// Create the pipeline
/*
new GithubCDKPipeline(project, {
  stackPrefix: 'MyApp',
  pkgNamespace: '@projen-pipelines-test',
  //engine: PipelineEngine.CODE_CATALYST,
  stages: [
    { name: 'dev', env: { account: '111111111111', region: 'eu-central-1' }, manualApproval: false },
    { name: 'dev2', env: { account: '13131313', region: 'eu-central-1' }, manualApproval: false },
    { name: 'staging', env: { account: '1212121212', region: 'eu-central-1' }, manualApproval: false },
    { name: 'preprod', env: { account: '111111111111', region: 'eu-central-1' }, manualApproval: false },
    { name: 'prod', env: { account: '222222222222', region: 'eu-west-1' }, manualApproval: true },
  ],
  iamRoleArns: {

  },
});
/*
new GitlabCDKPipeline(project, {
  stackPrefix: 'MyApp',
  pkgNamespace: '@projen-pipelines-test',
  //engine: PipelineEngine.CODE_CATALYST,
  stages: [
    { name: 'dev', env: { account: '111111111111', region: 'eu-central-1' }, manualApproval: false },
    { name: 'prod', env: { account: '222222222222', region: 'eu-west-1' }, manualApproval: true },
  ],
  iamRoleArns: {

  },
});
*/

new CodeCatalystCDKPipeline(project, {
  stackPrefix: 'MyApp',
  pkgNamespace: '@projen-pipelines-test',
  //engine: PipelineEngine.CODE_CATALYST,
  stages: [
    { name: 'dev', env: { account: '111111111111', region: 'eu-central-1' }, manualApproval: false },
    { name: 'dev2', env: { account: '13131313', region: 'eu-central-1' }, manualApproval: false },
    { name: 'staging', env: { account: '1212121212', region: 'eu-central-1' }, manualApproval: false },
    { name: 'preprod', env: { account: '111111111111', region: 'eu-central-1' }, manualApproval: false },
    { name: 'prod', env: { account: '222222222222', region: 'eu-west-1' }, manualApproval: true },
  ],
  iamRoleArns: {

  },
});

project.synth();