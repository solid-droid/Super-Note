import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';

async function generate() {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const tag = process.env.GITHUB_REF_NAME;
    const token = process.env.GITHUB_TOKEN;

    const octokit = new Octokit({ auth: token });

    console.log(`🔎 Fetching release for tag: ${tag}...`);
    
    const { data: release } = await octokit.repos.getReleaseByTag({
        owner,
        repo,
        tag,
    });

    const assets = release.assets;
    const version = tag.replace('v', '');
    const notes = release.body || "";
    const pub_date = release.published_at || new Date().toISOString();

    const platforms = {};

    // Map Tauri targets to JSON platform keys
    const platformMap = [
        { ext: 'x64_en-US.msi.zip', platform: 'windows-x86_64' },
        { ext: 'x64.msi.zip', platform: 'windows-x86_64' },
        { ext: 'x86_64.msi.zip', platform: 'windows-x86_64' },
        { ext: 'x64_en-US.msi', platform: 'windows-x86_64' },
        { ext: 'x64.msi', platform: 'windows-x86_64' },
        { ext: 'x86_64.msi', platform: 'windows-x86_64' },
        { ext: 'x64-setup.exe', platform: 'windows-x86_64' },
        { ext: 'x86_64-setup.exe', platform: 'windows-x86_64' },
        { ext: 'x86_64.app.tar.gz', platform: 'darwin-x86_64' },
        { ext: 'aarch64.app.tar.gz', platform: 'darwin-aarch64' },
        { ext: 'universal.app.tar.gz', platform: 'darwin-universal' },
        { ext: 'amd64.deb', platform: 'linux-x86_64' },
        { ext: 'x86_64.deb', platform: 'linux-x86_64' },
        { ext: 'AppImage.tar.gz', platform: 'linux-x86_64' },
        { ext: 'x86_64.AppImage.tar.gz', platform: 'linux-x86_64' }
    ];

    console.log(`📦 Found ${assets.length} total assets in release.`);
    assets.forEach(a => console.log(`  - ${a.name}`));

    // Process all assets to find matching platforms
    for (const asset of assets) {
        const binaryName = asset.name;
        console.log(`  👉 Processing asset: ${binaryName}`);
        
        // Find matching platform key by checking if binaryName ends with any of our extensions
        const match = platformMap.find(m => binaryName.endsWith(m.ext));
        
        if (match) {
            const key = match.platform;
            console.log(`    🎯 Matched platform ${key} for binary ${binaryName}`);
            
            platforms[key] = {
                url: asset.browser_download_url
            };
            console.log(`    ⭐ Successfully added ${key} to platforms.`);
        } else {
            console.log(`    ⚠️  No platform match in platformMap for binary: ${binaryName}`);
        }
    }

    const latestJson = {
        version,
        notes,
        pub_date,
        platforms
    };

    const outputPath = path.join(process.cwd(), 'latest.json');
    fs.writeFileSync(outputPath, JSON.stringify(latestJson, null, 2));
    console.log(`🚀 Final latest.json content:\n`, JSON.stringify(latestJson, null, 2));

    // Upload to release
    console.log(`📤 Uploading latest.json to release ${release.id}...`);
    
    // Delete existing latest.json if it exists
    const existingAsset = assets.find(a => a.name === 'latest.json');
    if (existingAsset) {
        console.log(`  🗑️  Deleting existing latest.json (ID: ${existingAsset.id})...`);
        await octokit.repos.deleteReleaseAsset({
            owner,
            repo,
            asset_id: existingAsset.id,
        });
    }

    await octokit.repos.uploadReleaseAsset({
        owner,
        repo,
        release_id: release.id,
        name: 'latest.json',
        data: fs.readFileSync(outputPath),
        headers: {
            'content-type': 'application/json',
            'content-length': fs.statSync(outputPath).size
        }
    });

    console.log('🎉 Done!');
}

generate().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
