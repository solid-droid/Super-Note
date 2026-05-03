import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const infoJsonPath = path.join(rootDir, 'info.json');

/**
 * Automatically creates a git tag and updates release info in info.json.
 * Usage: node scripts/create-tag.js [version/tag] [commit-hash]
 */
function createTag() {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    let info = {};
    if (fs.existsSync(infoJsonPath)) {
        info = JSON.parse(fs.readFileSync(infoJsonPath, 'utf-8'));
    }
    
    // 1. Determine Tag Name
    let tag = process.argv[2];
    
    if (!tag) {
        // Auto-increment from info.json or fallback to package.json
        const currentVersion = info.version || pkg.version;
        const parts = currentVersion.split('.');
        if (parts.length === 3) {
            const oldPatch = parts[2];
            parts[2] = parseInt(parts[2], 10) + 1;
            tag = `v${parts.join('.')}`;
            console.log(`📈 Auto-incrementing version: ${currentVersion} -> ${tag.replace('v', '')}`);
        } else {
            tag = `v${currentVersion}`;
        }
    }

    if (!tag.startsWith('v')) tag = `v${tag}`;

    // 2. Determine Commit Hash
    const commit = process.argv[3] || 'HEAD';

    // 3. Get Repo Info for URLs
    let repoUrl = "";
    try {
        repoUrl = execSync('git remote get-url origin').toString().trim();
        repoUrl = repoUrl.replace('.git', '').replace('git@github.com:', 'https://github.com/');
    } catch (e) {
        console.warn('⚠️ Could not determine remote repository URL.');
    }

    console.log(`🏷️  Preparing tag: ${tag} on commit: ${commit}`);

    // 4. Update info.json
    const newInfo = {
        name: pkg.name,
        version: tag.replace('v', ''),
        tag: tag,
        commit: execSync(`git rev-parse ${commit}`).toString().trim(),
        date: new Date().toISOString(),
        urls: {
            repo: repoUrl,
            latest_json: `${repoUrl}/releases/latest/download/latest.json`,
            downloads: {
                windows: `${repoUrl}/releases/download/${tag}/${pkg.name}_${tag.replace('v', '')}_x64_en-US.msi.zip`,
                macos_x64: `${repoUrl}/releases/download/${tag}/${pkg.name}_${tag.replace('v', '')}_x64.app.tar.gz`,
                macos_arm: `${repoUrl}/releases/download/${tag}/${pkg.name}_${tag.replace('v', '')}_aarch64.app.tar.gz`,
                linux: `${repoUrl}/releases/download/${tag}/${pkg.name}_${tag.replace('v', '')}_amd64.deb`,
                android: `${repoUrl}/releases/download/${tag}/${pkg.name}-${tag.replace('v', '')}.apk`
            }
        }
    };

    fs.writeFileSync(infoJsonPath, JSON.stringify(newInfo, null, 4));
    console.log('✅ info.json updated with release details.');

    // 5. Git Operations
    try {
        // Add info.json to commit (optional, but recommended if you want it tracked with the tag)
        execSync('git add info.json');
        
        // We only commit if there are changes
        const status = execSync('git status --porcelain info.json').toString();
        if (status) {
            execSync(`git commit -m "chore: release ${tag} info update"`);
        }

        // Create Tag
        execSync(`git tag -a ${tag} -m "Release ${tag}" ${commit}`);
        console.log(`✅ Tag ${tag} created.`);

        // Push
        console.log('📤 Pushing to remote...');
        execSync(`git push origin main`); // Ensure info.json is pushed
        execSync(`git push origin ${tag}`);
        console.log(`🚀 Successfully pushed ${tag} to origin.`);

    } catch (err) {
        console.error('❌ Git operation failed:', err.message);
        process.exit(1);
    }
}

createTag();
