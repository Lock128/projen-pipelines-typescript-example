import { awscdk } from 'projen';
import { CDKPipeline, PipelineEngine } from 'projen-pipelines';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'projen-pipelines-typescript-example',
  projenrcTs: true,
  github: false,
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
  devDeps: [
    'projen-pipelines',
  ],
});

// Create the pipeline
new CDKPipeline(project, {
  stackPrefix: 'MyApp',
  pkgNamespace: '@projen-pipelines-test',
  engine: PipelineEngine.CODE_CATALYST,
  stages: [
    {name: "dev", env:  { account: '111111111111', region: 'eu-central-1' },manualApproval: false },
    { name: "prod", env:  { account: '222222222222', region: 'eu-west-1' },manualApproval: true }
  ],
});

project.synth();