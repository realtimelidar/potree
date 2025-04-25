// Warn if overriding existing method
if(Array.prototype.equals)
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;
    // if the argument is the same array, we can be sure the contents are same as well
    if(array === this)
        return true;
    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
}
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

export const WS = (function() {
    let WS = {};

    let _connection = null;
    let _ready = false;

    /*
        0 = Waiting magic number
        1 = Waiting HELLO
    */
    let _state = 0;
    
    let _magicNumber = Array.from(new TextEncoder().encode("LidarServ Protocol"));
    let _protocolVersion = 4;

    let _events = new Map();

    WS.on = (eventName, callback) => {
        if (!_events.has(eventName)) {
            _events.set(eventName, []);
        }

        _events.get(eventName).push(callback);
    };

    WS.call = (eventName, ...args) => {
        if (!_events.has(eventName)) {
            return;
        }

        for (const cb of _events.get(eventName)) {
            cb(...args);
        }
    };

    WS.connect = (url) => {
        return new Promise((res, rej) => {
            try {
                _connection = new WebSocket(url);
                _connection.binaryType = "arraybuffer";
    
                _connection.addEventListener("open", _ => {
                    _ready = true;
                    console.log("opened websocket connection");

                    // send back magic number
                    _connection.send(new Uint8Array(_magicNumber));

                    // all good
                    res();
                });
    
                _connection.addEventListener("error", e => {
                    console.error("[ws error] " + e);
                })
    
                _connection.addEventListener("message", event => {
                    if (event.data instanceof ArrayBuffer) {
                        const u8data = new Uint8Array(event.data);
                        const data = Array.from(u8data);

                        console.log("received " + event.data.byteLength + " bytes");
                        console.log(data);

                        // exchange hello messages and check each others protocol compatibility
                        if (_state == 0 && data.equals(_magicNumber)) {
                            console.log("got handshake");
                            _state = 1;

                            // send hello message
                            WS.send({ 'Hello': { 'protocol_version': _protocolVersion }}, false);
                        } else if (_state == 1) {
                            const body = new Uint8Array(u8data.subarray(8)).buffer;
                            const decoded = CBOR.decode(body);
                            // const decoded = JSON.parse(new TextDecoder("utf-8").decode(body));

                            if (decoded["Hello"]) {
                                const pv = decoded["Hello"]["protocol_version"];

                                if (pv == _protocolVersion) {
                                    console.log("got HELLO")
                                    _state = 2;

                                    // tell the server that we are a viewer, that will query points.
                                    WS.send({ 'ConnectionMode': { 'device': 'Viewer' }}, false);
                                }
                            }
                        } else if (_state == 2) {
                            // wait for the point cloud info.
                            // (we don't need that info at the moment, so all we do with it is ignoring it...)

                            const body = new Uint8Array(u8data.subarray(8)).buffer;
                            const decoded = CBOR.decode(body);
                            // const decoded = JSON.parse(new TextDecoder("utf-8").decode(body));

                            if (decoded["PointCloudInfo"]) {
                                const coordinateSystem = decoded["PointCloudInfo"]["coordinate_system"];
                                const attributes = decoded["PointCloudInfo"]["attributes"];
                                const codec = decoded["PointCloudInfo"]["codec"];
                                const currentBoundingBox = decoded["PointCloudInfo"]["current_bounding_box"];

                                WS.call('InitialBoundingBox', currentBoundingBox);
                            }
                        }
                    }
                });
            } catch(e) {
                console.error("failed to create websocket connection (" + url + "): " + e);
                rej();
            }
        });
    };

    WS.send = (message, isJson = true) => {
        if (!_ready) {
            console.error("[send] not yet ready!");
            return;
        }

        let encoded;

        if (isJson) {
            encoded = new TextEncoder("utf-8").encode(JSON.stringify(message));
        } else {
            encoded = CBOR.encode(message);
        }

        const msg = new Uint8Array(encoded.byteLength + 8);
        const dv = new DataView(msg.buffer);
        
        dv.setUint32(0, msg.byteLength, true);
        msg.set(new Uint8Array(encoded), 8);

        console.log("sending (" + msg.byteLength + " bytes), ", msg);
        _connection.send(msg);
    };

    return WS;
})();