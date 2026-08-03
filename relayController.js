const modbus = require('jsmodbus');
const net = require('net');

const RELAY_IP = process.env.RELAY_IP || '192.168.1.200';
const RELAY_PORT = parseInt(process.env.RELAY_PORT || '502', 10);

/**
 * Triggers a Modbus TCP Relay Channel (e.g. Channel 1 = Coil 0) ON for a momentary pulse duration.
 * @param {number} channel - Relay channel index (0 = CH1, 1 = CH2, etc.)
 * @param {number} durationMs - Pulse duration in milliseconds (default 500ms)
 * @returns {Promise<{success: boolean, durationMs: number, message?: string}>}
 */
function triggerGateRelay(channel = 0, durationMs = 500) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const client = new modbus.client.TCP(socket, 1);
        let handled = false;

        socket.setTimeout(2500); // 2.5 second connection timeout

        socket.connect(RELAY_PORT, RELAY_IP, () => {
            console.log(`[Relay] Connected to Waveshare Relay (${RELAY_IP}:${RELAY_PORT}). Turning CH${channel + 1} ON...`);

            client.writeSingleCoil(channel, true)
                .then(() => {
                    console.log(`[Relay] Success! CH${channel + 1} ON (Gate Unlocked). Pulse: ${durationMs}ms`);

                    setTimeout(() => {
                        client.writeSingleCoil(channel, false)
                            .then(() => {
                                console.log(`[Relay] CH${channel + 1} OFF (Gate Relocked).`);
                                finish(true, `Gate triggered ON for ${durationMs}ms`);
                            })
                            .catch((err) => {
                                console.error(`[Relay] Error turning OFF CH${channel + 1}:`, err.message);
                                finish(true, `Triggered ON, off warning: ${err.message}`);
                            });
                    }, durationMs);
                })
                .catch((err) => {
                    console.error(`[Relay] Error writing coil ${channel}:`, err.message);
                    finish(false, `Modbus coil write error: ${err.message}`);
                });
        });

        socket.on('timeout', () => {
            console.warn(`[Relay] Timeout connecting to ${RELAY_IP}:${RELAY_PORT}`);
            finish(false, `Connection timeout to relay at ${RELAY_IP}:${RELAY_PORT}`);
        });

        socket.on('error', (err) => {
            console.warn(`[Relay] Socket connection error (${RELAY_IP}):`, err.message);
            finish(false, `Socket error: ${err.message}`);
        });

        function finish(success, message) {
            if (handled) return;
            handled = true;
            try {
                socket.destroy();
            } catch (e) {}
            resolve({ success, durationMs, message });
        }
    });
}

module.exports = {
    triggerGateRelay
};
