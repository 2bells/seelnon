import fs from 'fs';
import vm from 'vm';

const protobufJsCode = fs.readFileSync('./src/ide/utils/protobufjs.min.js', 'utf8');
const context = { window: {}, global: {}, console, Uint8Array, ArrayBuffer, Buffer };
vm.createContext(context);
vm.runInContext(protobufJsCode, context);
const protobuf = context.window.protobuf || context.protobuf;

const protoText = fs.readFileSync('./src/ide/utils/MW-Node-Editor-Pack/protobuf/gia.proto', 'utf8');
const root = protobuf.parse(protoText).root;
const Type = root.lookupType('Root');

function decodeGia(filePath) {
  const buf = fs.readFileSync(filePath);
  const u8 = new context.Uint8Array(buf.buffer, buf.byteOffset + 20, buf.length - 24);
  const msg = Type.decode(u8);
  return Type.toObject(msg, { defaults: true, longs: Number });
}

const gameAst = decodeGia('./uploads/compare/signal_test_game.gia');
const nodes = gameAst.graph.graph.inner.graph.nodes;

// Print all pins of Assembly List Int (Node 11)
const n11 = nodes.find(n => n.nodeIndex === 12);
console.log('Node 12 (Assembly List Int) pin count:', n11.pins.length);
console.log('Pin 0:', JSON.stringify(n11.pins[0], null, 2));
console.log('Pin 1:', JSON.stringify(n11.pins[1], null, 2));
console.log('Pin 2:', JSON.stringify(n11.pins[2], null, 2));
console.log('Pin 3 (unused element):', JSON.stringify(n11.pins[3], null, 2));
console.log('Pin 101 (OutParam):', JSON.stringify(n11.pins[101], null, 2));

// Print all pins of Assembly List Float (Node 15)
const n15 = nodes.find(n => n.nodeIndex === 15);
console.log('\nNode 15 (Assembly List Float) pin count:', n15.pins.length);
console.log('Pin 0:', JSON.stringify(n15.pins[0], null, 2));
console.log('Pin 1:', JSON.stringify(n15.pins[1], null, 2));
console.log('Pin 2:', JSON.stringify(n15.pins[2], null, 2));
console.log('Pin 3 (unused element):', JSON.stringify(n15.pins[3], null, 2));
console.log('Pin 101 (OutParam):', JSON.stringify(n15.pins[101], null, 2));
