import {
  decideKMeansAssignmentBackend,
  type KMeansBackendDecisionEvidence,
  type KMeansBenchmarkEnvironment,
} from './kmeansBackendPolicy';
import type { KMeansBackendProfileLoadResult } from './kmeansBackendProfileStore';
import type { KMeansProfileMigrationEvent } from './kmeansProfileMigration';

export const KMEANS_PROFILE_AUDIT_SCHEMA_VERSION = 'kmeans-profile-audit-1.0.0';
export const KMEANS_PROFILE_AUDIT_DIGEST_ALGORITHM = 'sha-256';

export interface KMeansProfileAuditWorkload {
  sampleCount: number;
  dimensions: number;
  maxClusters: number;
}

export interface KMeansProfileAuditDocument {
  schemaVersion: typeof KMEANS_PROFILE_AUDIT_SCHEMA_VERSION;
  generatedAt: string;
  scope: 'device-local-non-product-metadata';
  notice: 'not-a-cross-device-performance-conclusion';
  profileLoad: {
    status: KMeansBackendProfileLoadResult['status'];
    reason: string | null;
    savedAt: string | null;
  };
  profile: null | {
    schemaVersion: string;
    policyVersion: string;
    kernel: string;
    kernelVersion: string;
    protocolVersion: string;
    source: string;
    eligibleForRuntimeAutoSelection: boolean;
    status: string;
    generatedAt: string;
    expiresAt: string;
    crossoverWorkloadOperations: number | null;
    minimumImprovementRatio: number;
    maximumRelativeIqr: number;
    requiredConsecutiveWins: number;
    benchmarkReportDigest: string;
  };
  environment: KMeansBenchmarkEnvironment | null;
  workload: KMeansProfileAuditWorkload;
  autoDecision: KMeansBackendDecisionEvidence | null;
  migration: KMeansProfileMigrationEvent | null;
  migrationHistory: readonly KMeansProfileMigrationEvent[];
  excludedFields: readonly [
    'product-data',
    'clustering-inputs',
    'raw-benchmark-samples',
    'user-identity',
    'network-addresses',
  ];
  digestAlgorithm: typeof KMEANS_PROFILE_AUDIT_DIGEST_ALGORITHM;
  digest: string;
}

function validateWorkload(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return value;
}

export function stableKMeansAuditStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableKMeansAuditStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableKMeansAuditStringify(record[key])}`
  )).join(',')}}`;
}

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 is unavailable for the profile audit export');
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

function safeProfile(loadResult: KMeansBackendProfileLoadResult): KMeansProfileAuditDocument['profile'] {
  const profile = loadResult.profile;
  if (!profile) return null;
  return {
    schemaVersion: profile.schemaVersion,
    policyVersion: profile.policyVersion,
    kernel: profile.kernel,
    kernelVersion: profile.kernelVersion,
    protocolVersion: profile.protocolVersion,
    source: profile.source,
    eligibleForRuntimeAutoSelection: profile.eligibleForRuntimeAutoSelection,
    status: profile.status,
    generatedAt: profile.generatedAt,
    expiresAt: profile.expiresAt,
    crossoverWorkloadOperations: profile.crossoverWorkloadOperations,
    minimumImprovementRatio: profile.minimumImprovementRatio,
    maximumRelativeIqr: profile.maximumRelativeIqr,
    requiredConsecutiveWins: profile.requiredConsecutiveWins,
    benchmarkReportDigest: profile.benchmarkReportDigest,
  };
}

export async function createKMeansProfileAuditDocument(
  loadResult: KMeansBackendProfileLoadResult,
  workload: KMeansProfileAuditWorkload,
  generatedAt = new Date(),
): Promise<KMeansProfileAuditDocument> {
  const validatedWorkload = {
    sampleCount: validateWorkload(workload.sampleCount, 'sampleCount'),
    dimensions: validateWorkload(workload.dimensions, 'dimensions'),
    maxClusters: validateWorkload(workload.maxClusters, 'maxClusters'),
  };
  const environment = loadResult.environment;
  const autoDecision = environment
    ? decideKMeansAssignmentBackend({
        requestedBackend: 'auto',
        sampleCount: validatedWorkload.sampleCount,
        dimensions: validatedWorkload.dimensions,
        maxClusters: validatedWorkload.maxClusters,
        profile: loadResult.status === 'valid' ? loadResult.profile ?? undefined : undefined,
        environment,
        now: generatedAt,
      })
    : null;
  const core = {
    schemaVersion: KMEANS_PROFILE_AUDIT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    scope: 'device-local-non-product-metadata',
    notice: 'not-a-cross-device-performance-conclusion',
    profileLoad: {
      status: loadResult.status,
      reason: loadResult.reason,
      savedAt: loadResult.savedAt,
    },
    profile: safeProfile(loadResult),
    environment,
    workload: validatedWorkload,
    autoDecision,
    migration: loadResult.migration,
    migrationHistory: [...loadResult.migrationHistory],
    excludedFields: [
      'product-data',
      'clustering-inputs',
      'raw-benchmark-samples',
      'user-identity',
      'network-addresses',
    ],
    digestAlgorithm: KMEANS_PROFILE_AUDIT_DIGEST_ALGORITHM,
  } as const satisfies Omit<KMeansProfileAuditDocument, 'digest'>;
  const digest = await sha256(stableKMeansAuditStringify(core));
  return { ...core, digest };
}
