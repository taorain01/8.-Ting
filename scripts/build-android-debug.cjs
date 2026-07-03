const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const toolRoot = process.env.TING_ANDROID_TOOLCHAIN || path.join(os.homedir(), '.ting-android-toolchain');

function findChildDir(parent, predicate) {
  if (!fs.existsSync(parent)) return null;
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(parent, entry.name);
    if (predicate(fullPath)) return fullPath;
  }
  return null;
}

function getJavaMajor(jdkDir) {
  const releaseFile = path.join(jdkDir, 'release');
  if (!fs.existsSync(releaseFile)) return 0;
  const release = fs.readFileSync(releaseFile, 'utf8');
  const match = release.match(/^JAVA_VERSION="(\d+)/m);
  return match ? Number(match[1]) : 0;
}

function isJdk21(jdkDir) {
  return fs.existsSync(path.join(jdkDir, 'bin', 'java.exe')) && getJavaMajor(jdkDir) >= 21;
}

function findJdk() {
  const explicitJdk = process.env.TING_JAVA_HOME;
  if (explicitJdk && isJdk21(explicitJdk)) return explicitJdk;

  const localJdk21 = findChildDir(path.join(toolRoot, 'jdk21'), isJdk21);
  if (localJdk21) return localJdk21;

  if (process.env.JAVA_HOME && isJdk21(process.env.JAVA_HOME)) return process.env.JAVA_HOME;

  return null;
}

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(toolRoot, 'android-sdk'),
  ].filter(Boolean);

  return candidates.find((dir) => fs.existsSync(path.join(dir, 'platforms', 'android-35')));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.env || process.env,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status || 1);
}

const jdkDir = findJdk();
const sdkDir = findSdk();

if (!jdkDir) {
  console.error(`JDK 21 not found. Expected TING_JAVA_HOME, JAVA_HOME, or ${path.join(toolRoot, 'jdk21')}`);
  process.exit(1);
}

if (!sdkDir) {
  console.error(`Android SDK android-35 not found. Expected ANDROID_HOME or ${path.join(toolRoot, 'android-sdk')}`);
  process.exit(1);
}

if (!fs.existsSync(androidDir)) {
  console.error('Android platform not found. Run npm run android:add first.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: jdkDir,
  ANDROID_HOME: sdkDir,
  ANDROID_SDK_ROOT: sdkDir,
  PATH: [
    path.join(jdkDir, 'bin'),
    path.join(sdkDir, 'platform-tools'),
    process.env.PATH,
  ].filter(Boolean).join(path.delimiter),
};

const localProperties = `sdk.dir=${sdkDir.replace(/\\/g, '/')}\n`;
fs.writeFileSync(path.join(androidDir, 'local.properties'), localProperties);

run(process.execPath, [path.join('scripts', 'prepare-android-web.js')], { env });

run(process.execPath, [path.join('node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], { env });
run(process.execPath, [path.join('scripts', 'patch-android-back-button.cjs')], { env });

if (process.platform === 'win32') {
  run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join('scripts', 'sync-app-icons.ps1')], { env });
} else {
  console.warn('Skipping icon sync: scripts/sync-app-icons.ps1 is Windows-only.');
}

const rootGoogleServices = path.join(root, 'google-services.json');
const androidGoogleServices = path.join(androidDir, 'app', 'google-services.json');
if (fs.existsSync(rootGoogleServices)) {
  fs.copyFileSync(rootGoogleServices, androidGoogleServices);
}

const variablesGradle = path.join(androidDir, 'variables.gradle');
if (fs.existsSync(variablesGradle)) {
  let variables = fs.readFileSync(variablesGradle, 'utf8');
  if (!variables.includes('rgcfaIncludeGoogle')) {
    variables = variables.replace(/ext\s*\{\s*/, (match) => `${match}    rgcfaIncludeGoogle = true\n`);
  } else {
    variables = variables.replace(/rgcfaIncludeGoogle\s*=\s*(true|false)/, 'rgcfaIncludeGoogle = true');
  }
  fs.writeFileSync(variablesGradle, variables);
}

if (process.platform === 'win32') {
  run('cmd.exe', ['/d', '/c', '.\\gradlew.bat assembleDebug'], { cwd: androidDir, env });
} else {
  run('./gradlew', ['assembleDebug'], { cwd: androidDir, env });
}
