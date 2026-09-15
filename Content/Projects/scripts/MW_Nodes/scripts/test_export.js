import fs from 'fs';
import vm from 'vm';
import { NODE_ID } from '../src/ide/utils/MW-Node-Editor-Pack/node_data/node_id.js';

// Setup protobuf
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

// Global window setup for GiaCodec
globalThis.window = {
  protobuf,
  rootProto: root,
  TypeRoot: Type
};

const { GiaCodec } = await import('../src/giaCodec.js');

const gameBuf = fs.readFileSync('./uploads/compare/signal_test_game.gia');
const state = GiaCodec.importFromBuffer(gameBuf.buffer.slice(gameBuf.byteOffset, gameBuf.byteOffset + gameBuf.byteLength));

console.log('Imported state nodes count:', state.nodes.length);
console.log('Assembly List nodes in state:');
state.nodes.filter(n => n.name === 'Assembly List' || n.blueprintId === 'op_assembly_list').forEach(n => {
  console.log(`Node ${n.id} name:${n.name} dataType:${n.dataType} pinTypes:`, n.pinTypes, `dynamicInputs:`, n.dynamicInputs, `inputValues:`, n.inputValues);
});

const ast = GiaCodec._graphStateToAst(state);
console.log('\nConverted to AST graph nodes:');
const revMap = {};
for (const [k, v] of Object.entries(NODE_ID)) {
  if (!revMap[v]) revMap[v] = [];
  revMap[v].push(k);
}

ast.graphNodes.forEach((n, idx) => {
  const gName = revMap[n.genericId]?.[0] || 'unknown';
  const cName = revMap[n.concreteId]?.[0] || 'unknown';
  console.log(`Node #${idx+1} Generic: ${n.genericId} (${gName}) -> Concrete: ${n.concreteId} (${cName}) [${n.pins.length} pins]`);
});
