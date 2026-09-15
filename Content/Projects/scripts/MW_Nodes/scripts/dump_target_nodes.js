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

const game = decodeGia('./uploads/compare/signal_test_game.gia');
const lua3 = decodeGia('./uploads/compare/LUA3_Signal_test_.gia');

const gameNodes = game.graph.graph.inner.graph.nodes;
const lua3Nodes = lua3.graph.graph.inner.graph.nodes;

console.log('=== GAME NODE 8 (3D Vector) ===');
console.log(JSON.stringify(gameNodes.find(n => n.nodeIndex === 8), null, 2));

console.log('=== LUA3 NODE 7 (3D Vector) ===');
console.log(JSON.stringify(lua3Nodes.find(n => n.nodeIndex === 7), null, 2));

console.log('=== GAME NODE 9 (Addition) ===');
console.log(JSON.stringify(gameNodes.find(n => n.nodeIndex === 9), null, 2));

console.log('=== LUA3 NODE 8 (Addition) ===');
console.log(JSON.stringify(lua3Nodes.find(n => n.nodeIndex === 8), null, 2));

console.log('=== GAME NODE 10 (Finite Loop) ===');
console.log(JSON.stringify(gameNodes.find(n => n.nodeIndex === 10), null, 2));

console.log('=== LUA3 NODE 9 (Finite Loop) ===');
console.log(JSON.stringify(lua3Nodes.find(n => n.nodeIndex === 9), null, 2));

console.log('=== GAME NODE 14 (List Sorting) ===');
console.log(JSON.stringify(gameNodes.find(n => n.nodeIndex === 14), null, 2));

console.log('=== LUA3 NODE 12 (List Sorting) ===');
console.log(JSON.stringify(lua3Nodes.find(n => n.nodeIndex === 12), null, 2));
