/**
 * @file src/types.ts
 * Type definitions and interfaces for dropx.
 */

export type BumpType = 'patch' | 'minor' | 'major' | 'prerelease';

export type EngineType = 'auto' | 'changeset' | 'release-it' | 'internal';

export type AccessType = 'public' | 'restricted';

export interface CliOptions {
  bump: BumpType;
  isExplicitBump: boolean;
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
  subject: string;
  body: string;
  rawSubject: string;
}

export interface BumpDetectionResult {
  bump: BumpType;
  reason: string;
  commits: ConventionalCommit[];
}
