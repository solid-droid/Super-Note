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
    const platformMap = {
        // Windows
        'x64_en-US.msi.zip': 'windows-x86_64',
        'x64.msi.zip': 'windows-x86_64',
        'x86_64.msi.zip': 'windows-x86_64',
        'x64_en-US.msi': 'windows-x86_64',
        'x64.msi': 'windows-x86_64',
        'x86_64.msi': 'windows-x86_64',
        'x64-setup.exe': 'windows-x86_64',
        'x86_64-setup.exe': 'windows-x86_64',
        
        // macOS
        'x86_64.app.tar.gz': 'darwin-x86_64',
        'aarch64.app.tar.gz': 'darwin-aarch64',
        'universal.app.tar.gz': 'darwin-universal',
        
        // Linux
        'amd64.deb': 'linux-x86_64',
        'x86_64.deb': 'linux-x86_64',
        'AppImage.tar.gz': 'linux-x86_64',
        'x86_64.AppImage.tar.gz': 'linux-x86_64'
    };

    console.log(`📦 Found ${assets.length} assets in release.`);

    for (const asset of assets) {
        if (asset.name.endsWith('.sig')) {
            console.log(`  🔍 Processing signature: ${asset.name}`);
            const binaryName = asset.name.replace('.sig', '');
            const binaryAsset = assets.find(a => a.name === binaryName);
            
            if (binaryAsset) {
                // Find matching platform key
                const platformKey = Object.keys(platformMap).find(ext => binaryName.endsWith(ext));
                
                if (platformKey) {
                    const key = platformMap[platformKey];
                    console.log(`    ✅ Matched platform ${key} for binary ${binaryName}`);
                    
                    // Fetch signature content
                    const sigResponse = await fetch(asset.browser_download_url);
                    const signature = await sigResponse.text();

                    platforms[key] = {
                        signature: signature.trim(),
                        url: binaryAsset.browser_download_url
                    };
                } else {
                    console.log(`    ⚠️  No platform match for binary: ${binaryName}`);
                }
            } else {
                console.log(`    ❌ Binary not found for signature: ${asset.name}`);
            }
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
    console.log(`🚀 Generated latest.json:\n`, JSON.stringify(latestJson, null, 2));

    // Upload to release
    console.log(`uploading latest.json to release ${release.id}...`);
    
    // Delete existing latest.json if it exists
    const existingAsset = assets.find(a => a.name === 'latest.json');
    if (existingAsset) {
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
    console.error(err);
    process.exit(1);
});
