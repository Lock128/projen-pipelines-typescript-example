import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PipelineApp } from './app';
//import { BackendStack } from './stack';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // define resources here...
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};


const app = new PipelineApp({
  provideDevStack: (scope, id, props) => {
    return new MyStack(scope, id, {
      ...props,
    });
  },
  provideDev2Stack: (scope, id, props) => {
    return new MyStack(scope, id, {
      ...props,
    });
  },
  provideStagingStack: (scope, id, props) => {
    return new MyStack(scope, id, {
      ...props,
    });
  },
  providePreprodStack: (scope, id, props) => {
    return new MyStack(scope, id, {
      ...props,

    });
  },
  provideProdStack: (scope, id, props) => {
    return new MyStack(scope, id, {
      ...props,

    });
  },
  /* providePersonalStack: (scope, id, props) => {
    return new MyStack(scope, id, {
      ...props,

    });
  }, */
});

new MyStack(app, 'projen-pipelines-typescript-example-dev', { env: devEnv });
// new MyStack(app, 'projen-pipelines-typescript-example-prod', { env: prodEnv });

app.synth();