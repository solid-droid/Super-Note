import { Tauri } from './Tauri.js';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const Updater = {
    async check(onUserClick = false) {
        const update = await check();
        
        if (update) {
            // Use the notification method from the Tauri core
            const yes = await Tauri.notification(
                `Chamber ${update.version} is available!\n\nRelease notes: ${update.body}`, 
                { 
                    title: 'Update Available',
                    okLabel: 'Update',
                    cancelLabel: 'Cancel'
                }, 
                true // Set to true for a question/ask dialog
            );

            if (yes) {
                let downloaded = 0;
                let contentLength = 0;

                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started':
                            contentLength = event.data.contentLength;
                            console.log(`Started downloading ${contentLength} bytes`);
                            break;
                        case 'Progress':
                            downloaded += event.data.chunkLength;
                            console.log(`Downloaded ${downloaded} from ${contentLength}`);
                            break;
                        case 'Finished':
                            console.log('Download finished');
                            break;
                    }
                });

                console.log('Update installed');
                await relaunch();
            }
        } else if (onUserClick) {
            await Tauri.notification('You are on the latest version.', { 
                title: 'No Update Available' 
            });
        }
        
        return Tauri; // Maintain chainability
    }
};

// --- Auto-Register ---
Tauri.register('updater', Updater);

export default Updater;