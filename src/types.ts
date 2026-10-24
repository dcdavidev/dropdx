/**
 * @file src/types.ts
 * Type definitions and interfaces for dropdx.
 */

export type BumpType = 'patch' | 'minor' | 'major' | 'prerelease';

export type EngineType =
  | 'auto'
  | 'changeset'
  | 'release-it'
  | 'semantic-release'
  | 'lerna'
  | 'bumpp'
  | 'standard-version'
  | 'np'
  | 'internal';

export type AccessType = 'public' | 'restricted';

export interface DropdxConfig {
  $schema?: string;
  conventionalCommits?: boolean;
  registry?: string;
  engine?: EngineType;
  dryRun?: boolean;
  skipBuild?: boolean;
  skipGit?: boolean;
  skipPublish?: boolean;
  allowDirty?: boolean;
  provenance?: boolean;
  forceBump?: boolean;
  summary?: string;
}

export interface CliOptions {
  bump: BumpType;
  isExplicitBump: boolean;
  conventionalCommits?: boolean;
  dryRun: boolean;
  registry?: string;
  tag: string;
  access: AccessType;
  otp?: string;
  skipBuild: boolean;
  skipGit: boolean;
  skipPublish: boolean;
  allowDirty: boolean;
  engine: EngineType;
  summary?: string;
  provenance: boolean;
  isForceBump: boolean;
  configPath?: string;
  help?: boolean;
  version?: boolean;
}

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<string | number>;
}

export interface WorkspacePackage {
  name: string;
  version: string;
  directory: string;
  relativeDir: string;
  private: boolean;
  publishConfig: Record<string, unknown> & { access?: string };
  isPublishable: boolean;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts: Record<string, string>;
}

export interface NpmRegistryInfo {
  exists: boolean;
  isUnpublished: boolean;
  latestVersion?: string;
  maintainers: string[];
}

export interface VersionBump {
  name: string;
  oldVersion: string;
  newVersion: string;
  bumped: boolean;
}

export interface PublishResult {
  name: string;
  version: string;
  success: boolean;
  reason?: string;
}

export interface TargetVersionResult {
  targetVersion: string;
  bumpNeeded: boolean;
  reason: string;
}

export interface GitEnvironmentInfo {
  currentBranch: string;
  remoteUrl: string;
}

export interface ConventionalCommit {
  hash: string;
  type: string;
  scope?: string;
  isBreaking: boolean;
  isConventional: boolean;
  subject: string;
  body: string;
  rawSubject: string;
}

export interface BumpDetectionResult {
  bump: BumpType;
  reason: string;
  commits: ConventionalCommit[];
  isConventionalHistory: boolean;
}
