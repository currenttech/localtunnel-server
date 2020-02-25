const hri = require('human-readable-ids').hri;
const Client = require('./Client');
const TunnelAgent = require('./TunnelAgent');

// Manage sets of clients
//
// A client is a "user session" established to service a remote localtunnel client
class ClientManager {
    constructor(opt) {
        this.opt = opt || {};

        // id -> client instance
        this.clients = new Map();

        // statistics
        this.stats = {
            tunnels: 0
        };

        // This is totally wrong :facepalm: this needs to be per-client...
        this.graceTimeout = null;
    }

    // create a new tunnel with `id`
    // if the id is already used, a random id is assigned
    // if the tunnel could not be created, throws an error
    async newClient(id) {
        const clients = this.clients;
        const stats = this.stats;

        // can't ask for id already is use
        if (clients[id]) {
            id = hri.random();
            console.log(`id already used, new id: ${id}`);
        }

        const maxSockets = this.opt.max_tcp_sockets;
        console.log('creating agent');
        const agent = new TunnelAgent({
            clientId: id,
            maxSockets: 10,
        });

        console.log('creating client');
        const client = new Client({
            id,
            agent,
        });

        // add to clients map immediately
        // avoiding races with other clients requesting same id
        clients[id] = client;

        // client.once('close', () => {
        //     console.log('client.once calling close');
        //     this.removeClient(id);
        // });

        // try/catch used here to remove client id
        try {
            const info = await agent.listen();
            ++stats.tunnels;
            return {
                id: id,
                port: info.port,
                max_conn_count: maxSockets,
            };
        }
        catch (err) {
            this.removeClient(id);
            console.log('removing client');
            // rethrow error for upstream to handle
            throw err;
        }
    }

    removeClient(id) {
        console.log(`ClientManager: removing client: ${id}`);
        const client = this.clients[id];
        if (!client) {
            return;
        }
        --this.stats.tunnels;
        delete this.clients[id];
        client.close();
    }

    hasClient(id) {
        return !!this.clients[id];
    }

    getClient(id) {
        console.log('details', id, this.clients[id], this.clients);
        return this.clients[id];
    }
}

module.exports = ClientManager;
