// ~~ Generated by projen
/* eslint-disable */
import { App, AppProps, Stack, StackProps } from 'aws-cdk-lib';

/**
 * PipelineAppProps is an extension of AppProps, which is part of the AWS CDK core.
 * It includes optional functions to provide AWS Stacks for different stages.
 *
 * Use these functions to instantiate your application stacks with the parameters for
 * each stage
 */
export interface PipelineAppProps extends AppProps {
  /** This function will be used to generate a dev stack. */
  provideDevStack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
  /** This function will be used to generate a preprod stack. */
  providePreprodStack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
  /** This function will be used to generate a prod stack. */
  provideProdStack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;

}

/**
 * PipelineAppStackProps is an extension of StackProps, which is part of the AWS CDK core.
 * It includes an additional property to specify the stage name.
 */
export interface PipelineAppStackProps extends StackProps {
  stageName: string;
}

/**
 * The PipelineApp class extends the App class from AWS CDK and overrides the constructor to support
 * different stages of the application (development, production, personal, feature) by invoking the provided
 * stack-providing functions from the props.
 */
export class PipelineApp extends App {
  constructor(props: PipelineAppProps) {
    super(props);

    // If a function is provided for creating a dev stack, it is called with necessary arguments.
    if (props.provideDevStack) {
      props.provideDevStack(this, 'MyApp-dev', { env: {"account":"111111111111","region":"eu-central-1"}, stackName: 'MyApp-dev', stageName: 'dev' });
    }
    // If a function is provided for creating a preprod stack, it is called with necessary arguments.
    if (props.providePreprodStack) {
      props.providePreprodStack(this, 'MyApp-preprod', { env: {"account":"111111111111","region":"eu-central-1"}, stackName: 'MyApp-preprod', stageName: 'preprod' });
    }
    // If a function is provided for creating a prod stack, it is called with necessary arguments.
    if (props.provideProdStack) {
      props.provideProdStack(this, 'MyApp-prod', { env: {"account":"222222222222","region":"eu-west-1"}, stackName: 'MyApp-prod', stageName: 'prod' });
    }


  }
}
