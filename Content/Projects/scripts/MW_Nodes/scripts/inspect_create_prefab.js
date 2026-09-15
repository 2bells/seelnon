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
const luaAst = decodeGia('./uploads/compare/signal_test_LUA_2.gia');

const gameN = gameAst.graph.graph.inner.graph.nodes.find(n => n.nodeIndex === 7);
const luaN = luaAst.graph.graph.inner.graph.nodes.find(n => n.nodeIndex === 7);

console.log('=== GAME CREATE PREFAB (Node 7) ===');
console.log(JSON.stringify(gameN, null, 2));

console.log('=== LUA CREATE PREFAB (Node 7) ===');
console.log(JSON.stringify(luaN, null, 2));
