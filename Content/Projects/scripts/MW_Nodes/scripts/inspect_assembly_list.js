import fs from 'fs';
import vm from 'vm';
import { NODE_ID } from '../src/ide/utils/MW-Node-Editor-Pack/node_data/node_id.js';

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

// Find nodes with genericId == 169 (Assembly_List)
nodes.forEach((n, idx) => {
  if (n.genericId?.nodeId === 169) {
    console.log(`\n=== ASSEMBLY LIST NODE #${idx+1} (ConcreteId: ${n.concreteId?.nodeId}) ===`);
    console.log('Total pins:', n.pins?.length);
    console.log('Pin 0:', JSON.stringify(n.pins[0]));
    console.log('Pin 1:', JSON.stringify(n.pins[1]));
    console.log('Pin 2:', JSON.stringify(n.pins[2]));
    console.log('Pin 3:', JSON.stringify(n.pins[3]));
    console.log('Pin 100:', JSON.stringify(n.pins[100]));
    console.log('Pin 101:', JSON.stringify(n.pins[101]));
  }
});
