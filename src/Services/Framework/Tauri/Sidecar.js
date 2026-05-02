import { Tauri } from './Tauri.js';
import { Command } from '@tauri-apps/plugin-shell';

const DEFAULT_PROGRAM = 'bun-sidecar';

const createSidecarCommand = (program, args, options) => {
    return Command.sidecar(program, args, options);
};

const normalizeMessage = (value) => {
    if (typeof value === 'string' || value instanceof Uint8Array) return value;
    if (Array.isArray(value)) return value;
    return JSON.stringify(value);
};

const Sidecar = {
    instances: new Map(),
    programs: new Map([
        ['default', DEFAULT_PROGRAM],
        ['bun', 'bun-sidecar'],
        ['python', 'python-sidecar']
    ]),
    activeId: null,
    nextId: 0,

    registerProgram(key, program) {
        if (!key || !program) {
            throw new Error('registerProgram requires both a key and a program name.');
        }
        this.programs.set(key, program);
        return this;
    },

    getProgram(key) {
        return this.programs.get(key) ?? this.programs.get('default');
    },

    listPrograms() {
        return Array.from(this.programs.entries()).map(([key, program]) => ({ key, program }));
    },

    _resolveProgram(data) {
        if (data.program) {
            return data.program;
        }
        if (data.engine) {
            return this.getProgram(data.engine);
        }
        return this.getProgram('default');
    },

    _cleanupInstance(id) {
        const instance = this.instances.get(id);
        if (!instance) return;

        const { command } = instance;
        command.removeAllListeners?.();
        command.stdout?.removeAllListeners?.();
        command.stderr?.removeAllListeners?.();

        this.instances.delete(id);
        if (this.activeId === id) {
            this.activeId = null;
        }
    },

    async spawn(data = {}) {
        const id = data.id || `sidecar-${Date.now()}-${++this.nextId}`;
        if (this.instances.has(id)) {
            throw new Error(`Sidecar instance with id '${id}' already exists.`);
        }

        const {
            args = [],
            type = 'echo',
            msg = '',
            env = {},
            cwd,
            encoding,
            onMessage,
            onError,
            onExit
        } = data;

        const program = this._resolveProgram(data);
        const commandEnv = { ...env, ChamberMsg: JSON.stringify({ type, msg }) };
        const spawnOptions = { env: commandEnv };
        if (cwd) spawnOptions.cwd = cwd;
        if (encoding) spawnOptions.encoding = encoding;

        const command = createSidecarCommand(program, args, spawnOptions);

        const handleMessage = (line) => {
            if (typeof onMessage === 'function') {
                onMessage(line);
                return;
            }
            console.debug('[Sidecar] stdout:', line);
        };

        const handleError = (error) => {
            if (typeof onError === 'function') {
                onError(error);
                return;
            }
            console.error('[Sidecar] error:', error);
        };

        const handleClose = (payload) => {
            if (typeof onExit === 'function') {
                onExit(payload);
            } else {
                console.debug('[Sidecar] exited:', payload);
            }
            this._cleanupInstance(id);
        };

        command.stdout.on('data', handleMessage);
        command.stderr.on('data', handleError);
        command.on('error', handleError);
        command.on('close', handleClose);

        try {
            const child = await command.spawn();
            const instance = {
                id,
                program,
                args,
                command,
                child,
                pid: child.pid,
                send: async (message) => this.send(id, message),
                kill: async () => this.kill(id)
            };

            this.instances.set(id, instance);
            this.activeId = id;
            return instance;
        } catch (error) {
            command.removeAllListeners?.();
            command.stdout?.removeAllListeners?.();
            command.stderr?.removeAllListeners?.();
            handleError(error);
            throw error;
        }
    },

    async send(idOrMessage, message) {
        let id = typeof message === 'undefined' ? this.activeId : idOrMessage;
        const payload = typeof message === 'undefined' ? idOrMessage : message;

        if (!id) {
            throw new Error('No sidecar id provided and no active sidecar exists.');
        }

        const instance = this.instances.get(id);
        if (!instance) {
            throw new Error(`No sidecar instance found for id '${id}'.`);
        }

        return await instance.child.write(normalizeMessage(payload));
    },

    async kill(id) {
        const targetId = id ?? this.activeId;
        if (!targetId) {
            return false;
        }

        const instance = this.instances.get(targetId);
        if (!instance) {
            return false;
        }

        try {
            await instance.child.kill();
            return true;
        } finally {
            this._cleanupInstance(targetId);
        }
    },

    get(id) {
        return this.instances.get(id) ?? null;
    },

    list() {
        return Array.from(this.instances.values()).map((instance) => ({
            id: instance.id,
            program: instance.program,
            pid: instance.pid
        }));
    },

    isRunning(id) {
        if (typeof id === 'string') {
            return this.instances.has(id);
        }
        return this.instances.size > 0;
    },

    async nodeJS(data = {}) {
        return this.spawn({ engine: 'bun', ...data });
    }
};

// --- Auto-Register ---
Tauri.register('sidecar', Sidecar);

export default Sidecar;

/// Example Usage:
/*
(async () => {
    try {
        // Optionally register sidecar targets at runtime.
        Tauri.sidecar.registerProgram('bun', 'bun-sidecar');
        Tauri.sidecar.registerProgram('python', 'python-sidecar');

        const sidecarHandle = await Tauri.sidecar.spawn({
            id: 'bun-worker',
            engine: 'bun',
            args: ['--example', 'test'],
            env: { EXAMPLE_ENV: 'value' },
            onMessage: (msg) => console.log('Sidecar Message:', msg),
            onError: (err) => console.error('Sidecar Error:', err),
            onExit: (payload) => console.log('Sidecar Exited:', payload)
        });

        const { send, kill } = sidecarHandle;

        await send({ type: 'greet', payload: 'Hello from Tauri!' });

        // To kill this specific instance later:
        // await kill();

        console.log('Sidecar PID:', sidecarHandle.pid);

        const running = Tauri.sidecar.list();
        console.log('Running sidecars:', running);
    } catch (err) {
        console.error('Failed to spawn sidecar:', err);
    }
})();

if (Tauri.sidecar.isRunning()) {
    const runningInstances = Tauri.sidecar.list();
    console.log('Active sidecar instances:', runningInstances);
    // Send to the most recently spawned active sidecar:
    Tauri.sidecar.send({ type: 'update', payload: 'New message' }).catch(console.error);
    // Or target a specific instance by id:
    // await Tauri.sidecar.send('bun-worker', { type: 'update', payload: 'New message' });
    // await Tauri.sidecar.kill('bun-worker');
}
*/