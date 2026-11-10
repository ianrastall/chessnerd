export const enginePlatforms = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
  { value: 'android', label: 'Android' },
  { value: 'other', label: 'Other downloads' },
] as const;

export const engineArchitectures = [
  { value: 'x86-64', label: 'x86-64' },
  { value: 'x86', label: 'x86 (32-bit)' },
  { value: 'arm64', label: 'ARM64' },
  { value: 'arm32', label: 'ARM (32-bit)' },
  { value: 'riscv64', label: 'RISC-V 64' },
  { value: 'universal', label: 'Universal' },
] as const;

type Platform = typeof enginePlatforms[number]['value'];
type Architecture = typeof engineArchitectures[number]['value'];

const platformHints: ReadonlyArray<readonly [Exclude<Platform, 'other'>, RegExp]> = [
  ['windows', /(?:^|[^a-z0-9])(?:windows|win(?:32|64|10|11|x64|x86)?)(?=$|[^a-z0-9])|\.(?:exe|msi)$/i],
  ['macos', /(?:^|[^a-z0-9])(?:mac(?:os|64|32|[-_]silicon)?|osx|darwin|apple[-_](?:silicon|m\d+))(?=$|[^a-z0-9])|\.(?:dmg|pkg)$/i],
  ['linux', /(?:^|[^a-z0-9])(?:linux(?:32|64)?|ubuntu|debian)(?=$|[^a-z0-9])|\.(?:appimage|deb|rpm)$/i],
  ['android', /(?:^|[^a-z0-9])android(?=$|[^a-z0-9])|\.apk$/i],
];

const architectureHints: ReadonlyArray<readonly [Exclude<Architecture, 'universal'>, RegExp]> = [
  ['x86-64', /(?:^|[^a-z0-9])(?:x86[-_]?64|amd64|(?:win)?x64)(?=$|[^a-z0-9])/i],
  ['x86', /(?:^|[^a-z0-9])(?:i[3-6]86|(?:win)?x86(?![-_]?64))(?=$|[^a-z0-9])/i],
  ['arm64', /(?:^|[^a-z0-9])(?:arm64|aarch64|(?:apple|mac)[-_]silicon|apple[-_]m\d+)(?=$|[^a-z0-9])/i],
  ['arm32', /(?:^|[^a-z0-9])(?:arm32|armhf|armv7a?)(?=$|[^a-z0-9])/i],
  ['riscv64', /(?:^|[^a-z0-9])riscv[-_]?64(?=$|[^a-z0-9])/i],
];

export function classifyEngineDownload(name: string): { platform: Platform; architecture: Architecture | null } {
  if (/\.(?:txt|md|json|ya?ml|sha1|sha256|sha512|md5|sig|asc|buildinfo|pdb|nnue|nn|epd|png|jpe?g)$/i.test(name)
      || /(?:^|[^a-z0-9])(?:source|src|checksums?|sha256sums)(?=$|[^a-z0-9])/i.test(name)) {
    return { platform: 'other', architecture: null };
  }

  const platforms = platformHints.filter(([, hint]) => hint.test(name));
  const platform = platforms.length === 1 ? platforms[0][0] : 'other';
  const architectures = architectureHints.filter(([, hint]) => hint.test(name));
  const architecture = architectures.length === 1 ? architectures[0][0] : null;
  const universal = platform === 'macos' && /(?:^|[^a-z0-9])universal2?(?=$|[^a-z0-9])/i.test(name);
  return { platform, architecture: architecture ?? (universal ? 'universal' : null) };
}
